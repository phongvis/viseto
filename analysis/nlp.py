'Common functions for natural language processing.'

from nltk.corpus import stopwords
from nltk.stem.wordnet import WordNetLemmatizer
import string
stop = set(stopwords.words('english'))
exclude = set(string.punctuation + '“”’—')
lemma = WordNetLemmatizer()

from gensim import corpora
from gensim.models.ldamodel import LdaModel

import spacy
spa = spacy.load('en')

from gensim.models.doc2vec import TaggedDocument
from gensim.models.doc2vec import Doc2Vec
from gensim.models import Word2Vec

def load_file(filename, parse=lambda x: x):
    'Load a text file and return lines after being parsed.'
    with open(filename, encoding='ISO-8859-1') as f:
        return [parse(line.strip()) for line in f]

def preprocess(docs, min_length=3):
    'Return documents after being preprocessed: stopwords/punctuation removal, lemmatization.'
    return [clean(doc, min_length) for doc in docs]

def clean(doc, min_length=3):
    punc_free_doc = ''.join(c for c in doc if c not in exclude)
    stop_free_words = [w for w in punc_free_doc.lower().split() if w not in stop]
    normalized_words = [lemma.lemmatize(w) for w in stop_free_words if len(w) >= min_length]
    return normalized_words

def split_sentences(text):
    'Split the text into sentences.'
    tokens = spa(text)
    return [sent.string.strip() for sent in tokens.sents]

def build_corpus_dictionary(docs, min_count=10):
    'Return gensim corpus and dictionary for a document collection.'
    dictionary = corpora.Dictionary(docs)
    dictionary.filter_extremes(no_below=min_count)
    corpus = [dictionary.doc2bow(doc) for doc in docs]
    return corpus, dictionary

def build_lda_with_corpus(corpus, dictionary, num_topics=10, passes=10, alpha='symmetric', eta=None, random_state=0):
    'Return LDA model from a gensim corpus.'
    return LdaModel(corpus, id2word=dictionary, num_topics=num_topics, passes=passes, alpha=alpha, eta=eta, random_state=random_state)

def build_lda(docs, num_topics=10, min_count=10, passes=10, alpha='symmetric', eta=None, random_state=0):
    'Return LDA model from a document collection.'
    corpus, dictionary = build_corpus_dictionary(docs, min_count)
    return build_lda_with_corpus(corpus, dictionary, num_topics=num_topics, passes=passes, alpha=alpha, eta=eta, random_state=random_state)

def build_doc2vec(docs, vector_size=100, window=5, min_count=10, epochs=100, random_state=0):
    'Return doc2vec model from a document collection.'
    tagged_docs = [TaggedDocument(doc, [idx]) for idx, doc in enumerate(docs)]
    model = Doc2Vec(vector_size=vector_size, window=window, min_count=min_count, epochs=epochs, seed=random_state)
    model.build_vocab(tagged_docs)
    model.train(tagged_docs, total_examples=model.corpus_count, epochs=model.epochs)
    return model

def build_word2vec(sentences, size=100, window=5, min_count=10, iter=100, random_state=0):
    'Return word2vec model from a sentence collection.'
    return Word2Vec(sentences, size=size, window=window, min_count=min_count, iter=iter, seed=random_state)