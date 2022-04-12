# SpaCy based article analytics API

## Install

```
pip install pipenv
pipenv install
pipenv run python -m textblob.download_corpora
pipenv run python -m spacy download en_core_web_sm
pipenv run python -m spacy download en_core_web_md
pipenv run python -m spacy download en_core_web_lg
pipenv run python -m spacy download en_core_web_lg
pipenv run python -m spacy download en_core_web_trf
pipenv run python -m spacy download xx_ent_wiki_sm
echo -e "import nltk\nnltk.download('punkt')\n" | pipenv run python -
pipenv run dev
```

### Links

- https://spacy.io/universe/project/spacy-textblob
- https://medium.com/analytics-vidhya/sentiment-analysis-using-textblob-ecaaf0373dff
