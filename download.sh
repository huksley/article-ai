#!/bin/sh
python -m spacy download en_core_web_sm
python -m spacy download en_core_web_md
python -m spacy download en_core_web_lg
python -m spacy download en_core_web_trf
python -m spacy download xx_ent_wiki_sm
python -m textblob.download_corpora
