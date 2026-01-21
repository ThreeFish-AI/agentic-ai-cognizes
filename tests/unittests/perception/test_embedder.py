"""
Unit tests for Embedder and Embedding Providers.

Tests cover:
- MockEmbeddingProvider
- SentenceTransformerProvider (if available)
- Embedder service
- Factory functions

Task ID: P3-5-3
"""

import pytest
import numpy as np
from cognizes.engine.perception.embedder import (
    Embedder,
    EmbeddingResult,
    MockEmbeddingProvider,
    SentenceTransformerProvider,
    get_embedder,
)


# ============================================
# MockEmbeddingProvider Tests
# ============================================


class TestMockEmbeddingProvider:
    """Tests for MockEmbeddingProvider."""

    def test_basic_embedding(self):
        """Test basic embedding generation."""
        provider = MockEmbeddingProvider(dimensions=1536)

        async def run():
            embeddings = await provider.embed(["Hello", "World"])
            return embeddings

        embeddings = pytest.importorskip("asyncio").get_event_loop().run_until_complete(run())

        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1536
        assert len(embeddings[1]) == 1536

    def test_embedding_reproducibility(self):
        """Test that same text produces same embedding."""
        provider = MockEmbeddingProvider(dimensions=384)

        async def run():
            emb1 = await provider.embed(["Test text"])
            emb2 = await provider.embed(["Test text"])
            return emb1, emb2

        emb1, emb2 = pytest.importorskip("asyncio").get_event_loop().run_until_complete(run())

        # Same text should produce same embedding
        assert np.allclose(emb1[0], emb2[0])

    def test_embedding_normalization(self):
        """Test that embeddings are normalized."""
        provider = MockEmbeddingProvider(dimensions=384)

        async def run():
            embeddings = await provider.embed(["Normalize test"])
            return embeddings

        embeddings = pytest.importorskip("asyncio").get_event_loop().run_until_complete(run())

        # Should be unit vector
        norm = np.linalg.norm(embeddings[0])
        assert np.isclose(norm, 1.0)

    def test_custom_dimensions(self):
        """Test custom embedding dimensions."""
        provider = MockEmbeddingProvider(dimensions=768)

        assert provider.dimensions == 768
        assert provider.model_name == "mock-embedding-model"


# ============================================
# Embedder Service Tests
# ============================================


class TestEmbedder:
    """Tests for Embedder service."""

    @pytest.fixture
    def embedder(self):
        """Create mock embedder."""
        return get_embedder(provider_type="mock", model_name="test-model")

    def test_embed_texts(self, embedder):
        """Test embedding multiple texts."""

        async def run():
            results = await embedder.embed_texts(["Hello", "World"], source="test")
            return results

        results = pytest.importorskip("asyncio").get_event_loop().run_until_complete(run())

        assert len(results) == 2
        assert isinstance(results[0], EmbeddingResult)
        assert results[0].text == "Hello"
        assert len(results[0].embedding) == embedder.dimensions

    def test_embed_query(self, embedder):
        """Test query embedding."""

        async def run():
            embedding = await embedder.embed_query("What is ML?")
            return embedding

        embedding = pytest.importorskip("asyncio").get_event_loop().run_until_complete(run())

        assert isinstance(embedding, list)
        assert len(embedding) == embedder.dimensions

    def test_embed_documents(self, embedder):
        """Test document embedding."""
        documents = [
            {"id": "1", "content": "First document"},
            {"id": "2", "content": "Second document"},
        ]

        async def run():
            docs = await embedder.embed_documents(documents)
            return docs

        docs = pytest.importorskip("asyncio").get_event_loop().run_until_complete(run())

        assert len(docs) == 2
        assert "embedding" in docs[0]
        assert len(docs[0]["embedding"]) == embedder.dimensions


# ============================================
# Factory Function Tests
# ============================================


class TestEmbedderFactory:
    """Tests for embedder factory functions."""

    def test_get_embedder_mock(self):
        """Test creating mock embedder."""
        embedder = get_embedder(provider_type="mock")

        assert embedder is not None
        assert embedder.model_name == "mock-embedding-model"

    def test_get_embedder_unknown(self):
        """Test unknown provider raises error."""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_embedder(provider_type="unknown")
