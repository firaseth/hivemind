import { ChromaClient, type Collection, type QueryResult, type Metadata } from "chromadb";

let client: ChromaClient | null = null;
let collection: Collection | null = null;

const getClient = (): ChromaClient => {
  if (!client) {
    client = new ChromaClient({ host: "127.0.0.1", port: 8000, ssl: false });
  }
  return client;
};

export const getChromaCollection = async (name = "hivemind"): Promise<Collection> => {
  if (!collection) {
    collection = await getClient().getOrCreateCollection({ name });
  }
  return collection;
};

export const embedText = async (text: string): Promise<number[]> => {
  const { pipeline } = await import("@huggingface/transformers");
  const featureExtractor = await pipeline("feature-extraction");
  const rawEmbedding = (await featureExtractor(text)) as unknown;

  if (!Array.isArray(rawEmbedding)) {
    throw new Error("Unexpected embedding output from Hugging Face pipeline");
  }

  const flattened = (rawEmbedding as any[])
    .flat(Infinity)
    .filter((item) => typeof item === "number") as number[];

  if (flattened.length === 0) {
    throw new Error("Unexpected empty embedding vector");
  }

  return flattened;
};

export const persistVectorDocument = async (
  id: string,
  text: string,
  metadata?: Metadata,
) => {
  const embeddings = [await embedText(text)];
  const coll = await getChromaCollection();
  await coll.upsert({ ids: [id], embeddings, documents: [text], metadatas: [metadata ?? {}] });
};

export const queryVectorStore = async (query: string, nResults = 3): Promise<QueryResult> => {
  const embedding = [await embedText(query)];
  const coll = await getChromaCollection();
  return coll.query({ queryEmbeddings: embedding, nResults });
};

export const findSimilarMemory = async (query: string, nResults = 5): Promise<string[]> => {
  try {
    const result = await queryVectorStore(query, nResults);
    return result.documents?.flat().filter(Boolean) as string[] || [];
  } catch (error) {
    console.warn("Vector store query failed:", error);
    return [];
  }
};
