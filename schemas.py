from typing import List, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    session_id: Optional[str] = Field(default=None)
    lang: str = Field(default="en")
    enable_audio: bool = Field(default=False)
    top_k: int = Field(default=5, ge=1, le=20)


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    confidence: float
    session_id: str
    userToken: str
    notFound: bool = False


class CrawlWebsiteRequest(BaseModel):
    base_url: str
    max_pages: Optional[int] = None
    max_depth: Optional[int] = None


class CrawlWebsiteResponse(BaseModel):
    success: bool
    message: str
    job_id: str


class IngestUrlRequest(BaseModel):
    url: str


class IngestUrlResponse(BaseModel):
    success: bool
    message: str
    chunks_added: int = 0
    filename: Optional[str] = None


class TtsTestRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
