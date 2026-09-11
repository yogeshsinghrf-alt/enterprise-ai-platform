from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from sqlalchemy import select

from backend.app.db.database import SessionLocal
from backend.app.db.models import Document, DocumentChunk

load_dotenv()

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001"
)


def build_vector_store(chunks: list[str], filename: str):
    vectors = embeddings.embed_documents(chunks)

    with SessionLocal() as db:
        document = Document(filename=filename)
        db.add(document)
        db.flush()

        for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    content=chunk,
                    embedding=vector,
                )
            )

        db.commit()

    return len(chunks)


def search_knowledge(
    query: str,
    k: int = 4,
    document_id: int | None = None,
):
    query_vector = embeddings.embed_query(query)

    distance = DocumentChunk.embedding.cosine_distance(query_vector)

    with SessionLocal() as db:
        statement = (
            select(
                DocumentChunk.id,
                DocumentChunk.document_id,
                DocumentChunk.chunk_index,
                DocumentChunk.content,
                Document.filename,
                distance.label("distance"),
            )
            .join(
                Document,
                Document.id == DocumentChunk.document_id,
            )
        )

        if document_id is not None:
            statement = statement.where(
                DocumentChunk.document_id == document_id
            )

        statement = (
            statement
            .order_by(distance)
            .limit(k)
        )

        rows = db.execute(statement).all()

        results = []

        for row in rows:
            similarity_score = max(
                0.0,
                min(1.0, 1.0 - float(row.distance))
            )

            results.append(
                {
                    "chunk_id": row.id,
                    "document_id": row.document_id,
                    "chunk_index": row.chunk_index,
                    "filename": row.filename,
                    "content": row.content,
                    "distance": round(float(row.distance), 4),
                    "similarity_score": round(similarity_score, 4),
                }
            )

        return results