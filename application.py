"""Article AI"""

import json
from typing import List, Dict, Any
import os
import re
from enum import Enum
import logging
import psutil
import gc
from string import punctuation
import numpy as np

from spacytextblob.spacytextblob import SpacyTextBlob
from flask import Flask, redirect, render_template, send_from_directory, request, Response

import spacy
from spacy.tokens import Doc

if not Doc.has_extension("text_id"):
    Doc.set_extension("text_id", default=None)

application = Flask(__name__)
application.secret_key = os.environ.get('FLASK_SECRET_KEY', '123')
application.config['TEMPLATES_AUTO_RELOAD'] = 1
application.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

if os.environ.get('FLASK_LOG_FILE_PATH') is not None:
    logging.basicConfig(
        filename=os.environ.get('FLASK_LOG_FILE_PATH'),
        level=logging.INFO)
else:
    logging.basicConfig(level=logging.INFO)

logging.getLogger("werkzeug").setLevel(logging.WARN)
logger = logging.getLogger()
logger.setLevel(logging.INFO)


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
    # pylint: disable=fixme, invalid-name
    en_core_web_md = "en_core_web_md"
    # pylint: disable=fixme, invalid-name
    en_core_web_lg = "en_core_web_lg"
    # pylint: disable=fixme, invalid-name
    en_core_web_trf = "en_core_web_trf"
    # pylint: disable=fixme, invalid-name
    xx_ent_wiki_sm = "xx_ent_wiki_sm"


MODELS = {}


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
        for (k, v) in obj.items():
            logger.info("Level items %s", k)
            data[k] = todict(v, classkey, level + 1)
        return data
    elif hasattr(obj, "_ast"):
        return todict(obj._ast(), None, level + 1)
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
    ents = []
    for ent in doc.ents:
        ents.append(
            {
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            })
    return {
        "text": doc.text,
        "ents": ents,
        "sentiment": doc.sentiment,
        "text_id": doc._.text_id
    }


def get_keywords(nlp, doc):
    """
    Very simple keyword extraction. FIXME:
    """
    result = []
    pos_tag = ['PROPN', 'ADJ', 'NOUN']  # 1
    for token in doc:
        tt = token.text.lower()
        if(tt in nlp.Defaults.stop_words or tt in punctuation):
            continue
        if token.pos_ in pos_tag:
            result.append(token.text)
    return list(set(result))


class PythonObjectEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (list, dict, str, int, float, bool, type(None))):
            return json.JSONEncoder.default(self, obj)
        return todict(obj)


def process_texts(model, texts):
    """
    Process a batch of articles and return the entities predicted by the
    given model.
    """
    if MODELS.get(model) is None:
        logger.info("Loading model %s", model)
        nlp = spacy.load(model)
        nlp.add_pipe("spacytextblob")
        MODELS[model] = nlp

    nlp = MODELS[model]
    response = []
    docs = []
    previous = None

    for doc in nlp.pipe(texts):
        docs.append(doc)

    for doc in docs:
        doc_data = get_data(doc)
        if previous is not None:
            doc_data["similarity"] = doc.similarity(previous)
        if doc._.blob is not None:
            doc_data["polarity"] = doc._.blob.polarity
            doc_data["subjectivity"] = doc._.blob.subjectivity
            doc_data["assessments"] = doc._.blob.sentiment_assessments.assessments
            doc_data["ngrams"] = doc._.blob.ngrams()
            doc_data["word_counts"] = doc._.blob.word_counts
            doc_data["keywords"] = get_keywords(nlp, doc)
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
        Supply chain disruptions — triggered by factors including demand surges, high transportation costs and pandemic-related lockdowns — are expected to continue well into next year, experts predict. Companies are experiencing the brunt of the impact, with 36% of small businesses responding to a 2021 U.S. Census survey reporting that they’ve experienced delays with domestic suppliers. This has been costly. According to a 2020 Statista survey, 41% of executives in the automotive and transportation industry alone said their company lost $50 to $100 million due to supply chain issues, a figure which has likely climbed higher since.

        There’s no easy fix, but an emerging cohort of startups is pitching software as a way to potentially anticipate — and respond to — market shocks. One, Tive, provides supply chain visibility insights that ostensibly help companies manage their in-transit shipments’ location and condition. Tive today announced that it raised $54 million in a Series B financing round led by AXA Venture Partners with participation from Sorenson Capital, Qualcomm Ventures, Fifth Wall, SJF Ventures and Floating Point Ventures, which CEO Krenar Komoni's article attributes to the company’s growth over the past year.
        """,
        """
        April 11, 2022 –Tive, the technology leader in the new era of supply chain and logistics visibility, today announced the closing of a $54M Series B funding led by AXA Venture Partners, with participation from Sorenson Capital, Qualcomm Ventures, Fifth Wall, SJF Ventures and Floating Point Ventures as well as the existing investors RRE Ventures, Two Sigma Ventures, NextView Ventures, Hyperplane Ventures, Broom Ventures, and Supply Chain Ventures.

        In 2021, Tive grew its revenue by over 300%, acquired more than 200 new customers and expanded its global footprint. This latest investment will fuel Tive's rapidly growing international presence, with the expansion of global sales and marketing initiatives. In addition, it will accelerate the development and introduction of next-generation solutions, services and bring actionable supply chain intelligence and 24/7 monitoring to the market.

        #1 in Supply Chain and Logistics Condition and Location Monitoring

        Tive continues to outpace and out-innovate the competition with the most advanced multi-sensor trackers, a truly intuitive SaaS application, and live 24/7 shipment monitoring service. As the leading provider of supply chain tracking technology, Tive has delivered real-time shipment visibility in more than 200 countries, and helped save thousands of shipments from being delayed, damaged, spoiled, or rejected.
        """
    ]
    response_body = process_texts("en_core_web_md", texts)
    resp = Response(json.dumps(response_body, cls=PythonObjectEncoder))
    resp.headers['Content-Type'] = 'application/json'
    gc.collect()
    return resp


@application.route("/process", methods=('POST',))
def process():
    """
    Process one or more texts, generating article analytics.
    """
    data = request.get_json()
    model = data.get("model") or "en_core_web_md"
    texts = data.get("texts") or []
    logger.info("Memory usage: {}".format(psutil.virtual_memory()))
    response_body = process_texts(model, texts)
    resp = Response(json.dumps(response_body, cls=PythonObjectEncoder))
    resp.headers['Content-Type'] = 'application/json'
    resp.headers['Cache-Control'] = 'no-cache, no-store, max-age=0'
    resp.headers['Access-Control-Max-Age'] = '86400'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


if __name__ == "__main__":
    # Setting debug to True enables debug output. This line should be
    # removed before deploying a production app.
    application.debug = True
    application.run()
