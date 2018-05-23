'Common functions for natural language processing.'

from nltk.corpus import stopwords
from nltk.stem.wordnet import WordNetLemmatizer
import string

from gensim import corpora
from gensim.models.ldamodel import LdaModel

stop = set(stopwords.words('english'))
exclude = set(string.punctuation + '“”’—')
lemma = WordNetLemmatizer()

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

def build_corpus_dictionary(docs):
    'Return gensim corpus and dictionary for a document collection.'
    dictionary = corpora.Dictionary(docs)
    corpus = [dictionary.doc2bow(doc) for doc in docs]
    return corpus, dictionary

def build_lda(docs, num_topics=10, passes=10, alpha='symmetric', eta=None, random_state=0):
    'Return LDA model from a document collection. Each document is an array of tokens.'
    dictionary = corpora.Dictionary(docs)
    corpus = [dictionary.doc2bow(doc) for doc in docs]
    return build_lda_with_corpus(corpus, dictionary, num_topics=num_topics, passes=passes, alpha=alpha, eta=eta, random_state=random_state)

def build_lda_with_corpus(corpus, dictionary, num_topics=10, passes=10, alpha='symmetric', eta=None, random_state=0):
    'Return LDA model from a gensim corpus.'
    return LdaModel(corpus, id2word=dictionary, num_topics=num_topics, passes=passes, alpha=alpha, eta=eta, random_state=random_state)