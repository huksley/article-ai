"""Article AI"""

import gc
import json
from typing import List, Dict, Any
import os
import re
import time
import threading
from enum import Enum
import logging
from logging.handlers import RotatingFileHandler
import warnings
import psutil
import numpy as np
from flask import Flask, redirect, render_template, send_from_directory, request, Response
import spacy
from spacy.tokens import Doc
from keybert import KeyBERT

if not Doc.has_extension("text_id"):
    Doc.set_extension("text_id", default=None)

application = Flask(__name__)
application.secret_key = os.environ.get('FLASK_SECRET_KEY', '123')
application.config['TEMPLATES_AUTO_RELOAD'] = 1
application.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

if os.environ.get('FLASK_LOG_FILE_PATH') is not None:
    logging.basicConfig(
        force=True,
        handlers=[
            RotatingFileHandler(
                filename=os.environ.get('FLASK_LOG_FILE_PATH'),
                maxBytes=1024 * 1024 * 10,
                backupCount=10,
            ),
        ],
        format='%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s',
        level=logging.INFO)
else:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s')

logging.getLogger("werkzeug").setLevel(logging.WARN)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

logger.info("SpaCy version %s", spacy.about.__version__)

loading = threading.Semaphore()


@application.route("/")
def root():
    """Root page"""
    host = request.headers['Host']
    logger.info("Host: %s remote %s", host, request.remote_addr)
    if re.match(r'^www\.', host):
        return redirect("http://" + re.sub(r'^www\.', "", host), 301)
    content = render_template("root.html")
    webpage = render_template("index.html", content=content)
    resp = Response(webpage)
    resp.headers['Strict-Transport-Security'] = 'max-age=63072000'  # 2 years
    return resp


@application.route("/favicon.ico")
def favicon():
    """Redirect to proper favicon"""
    return redirect("static/icon.svg", code=302)


@application.route('/robots.txt')
@application.route('/site.webmanifest')
def static_from_root():
    """Mapping for static files"""
    return send_from_directory(application.static_folder, request.path[1:])


@application.route("/index.html")
def index():
    """Old root page"""
    return redirect(".", 302)


class ModelName(str, Enum):
    """
    Enum of the available models. This allows the API to raise a more specific
    error if an invalid model is provided.
    """
    # pylint: disable=fixme, invalid-name
    en_core_web_sm = "en_core_web_sm"
    en_core_web_md = "en_core_web_md"
    en_core_web_lg = "en_core_web_lg"
    en_core_web_trf = "en_core_web_trf"
    xx_ent_wiki_sm = "xx_ent_wiki_sm"
    fi_core_news_sm = "fi_core_news_sm"
    fi_core_news_lg = "fi_core_news_lg"
    sv_core_news_sm = "sv_core_news_sm"
    sv_core_news_lg = "sv_core_news_lg"


MODELS = {}
KEYWORD_MODELS = {}
KEYWORDS_DEFAULT = 20
KEYWORD_MODEL_DEFAULT = "all-MiniLM-L6-v2"

# if CUDA_VISIBLE_DEVICES defined and not empty, use GPU
CUDA_VISIBLE_DEVICES = os.environ.get('CUDA_VISIBLE_DEVICES')
if CUDA_VISIBLE_DEVICES is not None and CUDA_VISIBLE_DEVICES != "":
    logger.info("Using GPU")
    spacy.require_gpu()
else:
    logger.info("Using CPU")
    # Use CPU and after that initialize spacytextblob
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    spacy.require_cpu()

# You gotta be kidding me https://github.com/ultralytics/yolov5/issues/6692
warnings.filterwarnings(
    'ignore', message='User provided device_type of \'cuda\', but CUDA is not available. Disabling')

from spacytextblob.spacytextblob import SpacyTextBlob  # nopep8, pylint: disable=unused-import,wrong-import-position


@application.route("/models")
def get_models() -> List[str]:
    """Return a list of all available loaded models."""
    return json.dumps([model.value for model in ModelName])


def todict(obj, classkey=None, level=0):
    """
    Converts object to dictionary so it can be written as JSON
    """
    if level > 10:
        logger.warning("todict recursion limit reached")
        return None
    if isinstance(obj, dict):
        data = {}
        for (key, value) in obj.items():
            logger.info("Level items %s", key)
            data[key] = todict(value, classkey, level + 1)
        return data
    elif hasattr(obj, "_ast"):
        return todict(obj._ast(), None, level + 1)  # pylint: disable=protected-access
    elif hasattr(obj, "__iter__"):
        return [todict(v, classkey, level + 1) for v in obj]
    elif hasattr(obj, "__dict__"):
        data = dict([(key, todict(value, classkey, level + 1))
                     for key, value in obj.__dict__.iteritems()
                     if not callable(value) and not key.startswith('_') and key not in ['name']])
        if classkey is not None and hasattr(obj, "__class__"):
            data[classkey] = obj.__class__.__name__
        return data
    elif isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    elif isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                          np.int16, np.int32, np.int64, np.uint8,
                          np.uint16, np.uint32, np.uint64)):
        return int(obj)
    elif isinstance(obj, (np.float_, np.float16, np.float32,
                          np.float64)):
        return float(obj)
    elif hasattr(obj, "__unicode__"):
        return {'type': type(obj).__name__, 'text': obj.__unicode__()}
    logger.info("Unknown %s", type(obj))
    return {'type': type(obj).__name__}


def get_data(doc: Doc) -> Dict[str, Any]:
    """
    Extract the data to return from the REST API given a Doc object. Modify
    this function to include other data.
    See more here: https://spacy.io/usage/linguistic-features
    """
    entities = []
    for ent in doc.ents:
        entities.append(
            {
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            })
    return {
        "text": doc.text,
        "entities": entities,
        "text_id": doc._.text_id
    }


def get_keywords(doc, keyword_model, top_n=KEYWORDS_DEFAULT, lang: str = "en"):
    """
    Keyword extraction using KeyBERT with SpaCy embeddings

    https://github.com/MaartenGr/KeyBERT
    https://maartengr.github.io/KeyBERT/guides/embeddings.html#hugging-face-transformers
    https://www.sbert.net/docs/pretrained_models.html
    https://github.com/MartinoMensio/spacy-sentence-bert
    """
    if keyword_model is None:
        keyword_model = KEYWORD_MODEL_DEFAULT

    if keyword_model not in KEYWORD_MODELS:
        loading.acquire()
        start = time.time_ns()
        logger.info("Loading keyword model %s", keyword_model)
        KEYWORD_MODELS[keyword_model] = KeyBERT(keyword_model)
        end = time.time_ns()
        logger.info("Loaded keyword model %s in %s ms",
                    keyword_model, (end - start) / 1000000)
        loading.release()

    kw_model = KEYWORD_MODELS.get(keyword_model)
    # Generates [[keyword, score]]
    keywords_scored = kw_model.extract_keywords(doc.text,
                                                keyphrase_ngram_range=(1, 1),
                                                stop_words=None,
                                                top_n=top_n)
    keywords = []
    for keyword, score in keywords_scored:  # pylint: disable=unused-variable
        keywords.append(keyword)
    return keywords


class PythonObjectEncoder(json.JSONEncoder):
    """
    JSON encoder for Python objects
    """

    def default(self, o):
        if isinstance(o, (list, dict, str, int, float, bool, type(None))):
            return json.JSONEncoder.default(self, o)
        return todict(o)


def load_model(model: str, language="en"):
    """
    Load a model or return it if it's already loaded.
    """

    loading.acquire()

    # Check model exists in ModelName class
    if model not in ModelName.__members__:
        raise ValueError(f"Unknown model: {model}")

    if language is None:
        language = "en"

    if MODELS.get(model) is None:
        start = time.time_ns()
        logger.info("Loading model %s", model)
        nlp = spacy.load(model)
        nlp.add_pipe("spacytextblob")
        MODELS[model] = nlp
        end = time.time_ns()
        logger.info("Loaded model in %i ms", (end - start) / 1000000)

    loading.release()
    return MODELS[model]


def process_texts(texts, model, keyword_model=KEYWORD_MODEL_DEFAULT,
                  top_n=KEYWORDS_DEFAULT, lang="en", as_tuples=False):
    """
    Process a batch of articles and return the entities predicted by the
    given model.
    """
    nlp: spacy.language.Language = load_model(model, lang)
    response = []
    docs = []
    previous = None

    start = time.time_ns()
    ids = []
    disable = []

    # spacytextblob suppots only English
    if lang != "en":
        disable.append("spacytextblob")

    if as_tuples:
        for doc, context in nlp.pipe(texts, as_tuples=True, disable=disable):
            doc._.text_id = context["text_id"]
            ids.append(context["text_id"])
            docs.append(doc)
    else:
        for doc in nlp.pipe(texts, as_tuples=False, disable=disable):
            docs.append(doc)

    end = time.time_ns()
    logger.info("Done analytics for %s in %s ms", ids, (end - start) / 1000000)

    for doc in docs:
        doc_data = get_data(doc)
        # Runtime information
        doc_data["model"] = model
        doc_data["language"] = lang
        doc_data["spacy_version"] = spacy.__version__
        doc_data["spacy_extensions"] = [
            s for s in list(nlp.pipe_names) if s not in disable]
        # Similarity to previous text
        if previous is not None:
            doc_data["similarity"] = doc.similarity(previous)
        if doc.has_extension("blob") and doc._.blob is not None:
            doc_data["polarity"] = doc._.blob.polarity
            doc_data["subjectivity"] = doc._.blob.subjectivity
            doc_data["assessments"] = doc._.blob.sentiment_assessments.assessments
            doc_data["ngrams"] = doc._.blob.ngrams()
            doc_data["word_counts"] = doc._.blob.word_counts
        start = time.time_ns()
        doc_data["keywords"] = get_keywords(doc, keyword_model, top_n, lang)
        doc_data["spacy_extensions"].append("keybert")
        end = time.time_ns()
        logger.info("Done keyword extraction for %s in %s ms",
                    doc._.text_id, (end - start) / 1000000)
        response.append(doc_data)
        previous = doc
    return response


@application.route("/test")
def test():
    """
    Internally tests API on predefined text
    """
    texts = [
        """
        Supply chain disruptions — triggered by factors including demand surges,
        high transportation costs and pandemic-related lockdowns — are expected to
        continue well into next year, experts predict. Companies are experiencing
        the brunt of the impact, with 36% of small businesses responding to a 2021
        U.S. Census survey reporting that they’ve experienced delays with domestic
        suppliers. This has been costly. According to a 2020 Statista survey, 41% of
        executives in the automotive and transportation industry alone said their
        company lost $50 to $100 million due to supply chain issues, a figure which
        has likely climbed higher since.

        There’s no easy fix, but an emerging cohort of startups is pitching software
        as a way to potentially anticipate — and respond to — market shocks.
        One, Tive, provides supply chain visibility insights that ostensibly help
        companies manage their in-transit shipments’ location and condition.
        Tive today announced that it raised $54 million in a Series B financing
        round led by AXA Venture Partners with participation from Sorenson Capital,
        Qualcomm Ventures, Fifth Wall, SJF Ventures and Floating Point Ventures,
        which CEO Krenar Komoni's article attributes to the company’s growth over
        the past year.
        """,
        """
        April 11, 2022 –Tive, the technology leader in the new era of supply chain
        and logistics visibility, today announced the closing of a $54M Series B
        funding led by AXA Venture Partners, with participation from Sorenson Capital,
        Qualcomm Ventures, Fifth Wall, SJF Ventures and Floating Point Ventures as well
        as the existing investors RRE Ventures, Two Sigma Ventures, NextView Ventures,
        Hyperplane Ventures, Broom Ventures, and Supply Chain Ventures.

        In 2021, Tive grew its revenue by over 300%, acquired more than 200 new
        customers and expanded its global footprint. This latest investment will fuel
        Tive's rapidly growing international presence, with the expansion of global
        sales and marketing initiatives. In addition, it will accelerate the development
        and introduction of next-generation solutions, services and bring actionable
        supply chain intelligence and 24/7 monitoring to the market.

        # 1 in Supply Chain and Logistics Condition and Location Monitoring

        Tive continues to outpace and out-innovate the competition with the
        most advanced multi-sensor trackers, a truly intuitive SaaS application,
        and live 24/7 shipment monitoring service. As the leading provider
        of supply chain tracking technology, Tive has delivered real-time
        shipment visibility in more than 200 countries, and helped save thousands
        of shipments from being delayed, damaged, spoiled, or rejected.
        """
    ]
    response_body = process_texts(texts, "en_core_web_md")
    resp = Response(json.dumps(response_body, cls=PythonObjectEncoder))
    resp.headers['Content-Type'] = 'application/json'
    gc.collect()
    return resp


@application.route("/process", methods=('POST',))
def process():
    """
    Process one or more texts, generating article analytics.
    """
    start = time.time_ns()
    params = request.get_json()
    model = params.get("model") or "en_core_web_md"
    keyword_model = params.get("keyword_model")
    keywords = params.get("keywords") or KEYWORDS_DEFAULT
    texts = params.get("texts") or []
    ids = []
    lang = params.get("language") or "en"
    if keyword_model is None and lang != "en":
        keyword_model = "paraphrase-multilingual-MiniLM-L12-v2"
    if keyword_model is None:
        keyword_model = KEYWORD_MODEL_DEFAULT

    # Convert to tuples if necessary
    as_tuples = False
    if isinstance(texts[0], dict):
        as_tuples = True
        ids = [text["text_id"] for text in texts]
        texts = [(text["text"], {"text_id": text["text_id"]})
                 for text in texts]
    else:
        ids = [str(i) for i in range(len(texts))]

    logger.info("Processing texts (%s) with model %s", ids, model)

    try:
        response_body = process_texts(
            texts, model, keyword_model, keywords, lang, as_tuples)
    except Exception as err:  # pylint: disable=broad-except
        logger.error("Error processing %s: %s", ids, err, exc_info=True)
        response_body = {"error": str(err)}

    resp = Response(json.dumps(response_body, cls=PythonObjectEncoder))
    resp.headers['Content-Type'] = 'application/json'
    resp.headers['Cache-Control'] = 'no-cache, no-store, max-age=0'
    resp.headers['Access-Control-Max-Age'] = '86400'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    end = time.time_ns()
    logger.info("Processed %s in %i ms, memory usage: %s", ids, (end -
                start) / 1000000, f"{psutil.virtual_memory()}")
    return resp


if __name__ == "__main__":
    # Setting debug to True enables debug output. This line should be
    # removed before deploying a production app.
    application.debug = True
    application.run()
