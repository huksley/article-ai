#!/bin/bash

if [ ! -d $VIRTUAL_ENV/lib/python3.8/site-packages/en_core_web_sm ]; then
    python -m spacy download en_core_web_sm
fi

if [ ! -d $VIRTUAL_ENV/lib/python3.8/site-packages/en_core_web_md ]; then
    python -m spacy download en_core_web_md
fi

if [ ! -d $VIRTUAL_ENV/lib/python3.8/site-packages/en_core_web_lg ]; then
    python -m spacy download en_core_web_lg
fi

if [ ! -d $VIRTUAL_ENV/lib/python3.8/site-packages/en_core_web_trf ]; then
    python -m spacy download en_core_web_trf
fi

if [ ! -d $VIRTUAL_ENV/lib/python3.8/site-packages/xx_ent_wiki_sm ]; then
    python -m spacy download xx_ent_wiki_sm
fi

if [ ! -d $VIRTUAL_ENV/nltk_data ]; then
    python -m textblob.download_corpora
    echo -e "import nltk\nnltk.download('punkt')\n" | python -
    if [ -d $HOME/nltk_data ]; then
        mv $HOME/nltk_data $VIRTUAL_ENV/
    fi
fi

