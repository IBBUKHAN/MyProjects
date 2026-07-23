import os
from pathlib import Path

from dotenv import load_dotenv

_root = Path(__file__).resolve().parent
load_dotenv(_root / ".env")
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "gemini")

CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", str(_root / "chroma_db"))
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "uidai_docs")

# UIDAI-specific — only used in chat prompts, not in scraping
BOT_NAME = os.getenv("BOT_NAME", "Aadhaar Sevak")
BOT_DOMAIN = os.getenv(
    "BOT_DOMAIN",
    "Unique Identification Authority of India (UIDAI / Aadhaar)",
)

ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN", "change-me-in-prod")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")
ELEVENLABS_OUTPUT_FORMAT = os.getenv("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")
ELEVENLABS_STREAMING_LATENCY = os.getenv("ELEVENLABS_STREAMING_LATENCY", "3")
ELEVENLABS_STABILITY = float(os.getenv("ELEVENLABS_STABILITY", "0.5"))
ELEVENLABS_SIMILARITY = float(os.getenv("ELEVENLABS_SIMILARITY", "0.25"))
ELEVENLABS_STYLE = float(os.getenv("ELEVENLABS_STYLE", "0.6"))
ELEVENLABS_SPEED = float(os.getenv("ELEVENLABS_SPEED", "1.0"))
ELEVENLABS_SEED = int(os.getenv("ELEVENLABS_SEED", "260901"))
ELEVENLABS_USE_SPEAKER_BOOST = os.getenv("ELEVENLABS_USE_SPEAKER_BOOST", "true").lower() in (
    "1",
    "true",
    "yes",
)

CRAWL_MAX_PAGES = int(os.getenv("CRAWL_MAX_PAGES", "200"))
CRAWL_MAX_DEPTH = int(os.getenv("CRAWL_MAX_DEPTH", "3"))

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

FAQ_HUB_URL = "https://uidai.gov.in/en/contact-support/have-any-question.html"

# English FAQ category pages — each page has full Q&A accordion content
FAQ_URLS = [
    "https://uidai.gov.in/en/contact-support/have-any-question.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/281-english-uk/faqs/your-aadhaar/use-aadhaar-freely.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/282-english-uk/faqs/your-aadhaar/aadhaar-letter.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/286-english-uk/faqs/your-aadhaar/aadhaar-features,-eligibility.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/287-english-uk/faqs/your-aadhaar/security-in-uidai-system.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/288-english-uk/faqs/your-aadhaar/use-of-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/289-english-uk/faqs/your-aadhaar/protection-of-individual-information-in-uidai-system.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/290-english-uk/faqs/your-aadhaar/protection-of-the-individual-in-the-uidai-system.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/291-english-uk/faqs/your-aadhaar/nri-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/292-english-uk/faqs/your-aadhaar/pan-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1297-english-uk/faqs/your-aadhaar/myaadhaar-portal.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1474-english-uk/faqs/your-aadhaar/aadhaar-app.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/296-english-uk/faqs/enrolment-update/aadhaar-enrolment-process.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/297-english-uk/faqs/enrolment-update/aadhaar-updation.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/298-english-uk/faqs/enrolment-update/enrolment-partners-ecosystem-partners.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/299-english-uk/faqs/enrolment-update/enrolling-children.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/301-english-uk/faqs/enrolment-update/language-translitration.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/302-english-uk/faqs/enrolment-update/training-testing-certification.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1017-english-uk/faqs/enrolment-update/date-of-birth-update-in-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1044-english-uk/faqs/enrolment-update/find-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1045-english-uk/faqs/enrolment-update/myaadhaar-online-update-service.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1131-english-uk/faqs/enrolment-update/aadhaar-seva-kendra.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1137-english-uk/faqs/enrolment-update/enrolling-differently-abled.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1443-english-uk/faqs/enrolment-update/aadhaar-enrolment-update-charges.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1448-english-uk/faqs/enrolment-update/assam-nrc-cases.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1461-english-uk/faqs/enrolment-update/resident-foreign-nationals.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1462-english-uk/faqs/enrolment-update/mandatory-biometric-update.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/304-english-uk/faqs/authentication/for-aadhaar-number-holders.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1039-english-uk/faqs/authentication/offline-verification-and-role-of-ovses-under-authentication-eco-system.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/309-english-uk/faqs/direct-benefit-transfer-dbt/about-dbt.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/313-english-uk/faqs/about-uidai/grievance-redressal-mechanism.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1016-english-uk/faqs/about-uidai/uidai-chatbot-ask-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/283-english-uk/faqs/aadhaar-online-services/e-aadhaar.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/284-english-uk/faqs/aadhaar-online-services/virtual-id-vid.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/922-english-uk/faqs/aadhaar-online-services/online-address-update-process.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/305-english-uk/faqs/aadhaar-online-services/aadhaar-authentication-history.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/306-english-uk/faqs/aadhaar-online-services/secure-qr-code-reader-beta.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/307-english-uk/faqs/aadhaar-online-services/aadhaar-paperless-offline-e-kyc.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/925-english-uk/faqs/aadhaar-online-services/biometric-lock-unlock.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1012-english-uk/faqs/aadhaar-online-services/aadhaar-lock-unlock.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1014-english-uk/faqs/aadhaar-online-services/aadhaar-sms-service.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1024-english-uk/faqs/aadhaar-online-services/order-aadhaar-pvc-card-online.html",
    "https://uidai.gov.in/en/contact-support/have-any-question/1061-english-uk/faqs/aadhaar-online-services/document-update.html",
]

DATA_DIR = _root / "data"
WEBSITE_INDEX_FILE = DATA_DIR / "website_index.json"
