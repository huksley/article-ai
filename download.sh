#!/bin/bash

SPACY_VERSION=`python -c "import spacy; print('.'.join(spacy.about.__version__.split('.')[0:2]))"`
echo "Downloading SpaCy packages $SPACY_VERSION"

MODELS="en_core_web_sm en_core_web_md en_core_web_lg en_core_web_trf xx_ent_wiki_sm fi_core_news_sm fi_core_news_lg sv_core_news_sm sv_core_news_lg" 

for N in $MODELS; do
    if [ ! -d $VIRTUAL_ENV/lib/python3.8/site-packages/$N/${N}-$SPACY_VERSION* ]; then
        echo "Downloading $N"
        python -m spacy download $N
    else
        NAME=$(basename $VIRTUAL_ENV/lib/python3.8/site-packages/$N/${N}-$SPACY_VERSION*)
        echo "Exists $NAME"
    fi
done

if [ ! -d $VIRTUAL_ENV/nltk_data ]; then
    python -m textblob.download_corpora
    echo -e "import nltk\nnltk.download('punkt')\n" | python -
    if [ -d $HOME/nltk_data ]; then
        mv $HOME/nltk_data $VIRTUAL_ENV/
    fi
fi
