import { type UUID } from "crypto";
import { type BgentRuntime } from "./runtime";
import { type Memory, type SimilaritySearch } from "./types";

export const embeddingDimension = 1536;
export const embeddingZeroVector = Array(embeddingDimension).fill(0);

const defaultMatchThreshold = 0.1;
const defaultMatchCount = 10;

/**
 * Manage memories in the database.
 */
export class MemoryManager {
  /**
   * The BgentRuntime instance associated with this manager.
   */
  runtime: BgentRuntime;

  /**
   * The name of the database table this manager operates on.
   */
  tableName: string;

  /**
   * Constructs a new MemoryManager instance.
   * @param opts Options for the manager.
   * @param opts.tableName The name of the table this manager will operate on.
   * @param opts.runtime The BgentRuntime instance associated with this manager.
   */
  constructor({
    tableName,
    runtime,
  }: {
    tableName: string;
    runtime: BgentRuntime;
  }) {
    this.runtime = runtime;
    this.tableName = tableName;
  }

  /**
   * Adds an embedding vector to a memory object. If the memory already has an embedding, it is returned as is.
   * @param memory The memory object to add an embedding to.
   * @returns A Promise resolving to the memory object, potentially updated with an embedding vector.
   */
  async addEmbeddingToMemory(memory: Memory): Promise<Memory> {
    if (memory.embedding) {
      return memory;
    }

    const memoryText = memory.content.content;
    if (!memoryText) throw new Error("Memory content is empty");
    memory.embedding = memoryText
      ? await this.runtime.embed(memoryText)
      : embeddingZeroVector.slice();
    return memory;
  }

  /**
   * Retrieves a list of memories by user IDs, with optional deduplication.
   * @param opts Options including user IDs, count, and uniqueness.
   * @param opts.userIds An array of user IDs to retrieve memories for.
   * @param opts.count The number of memories to retrieve.
   * @param opts.unique Whether to retrieve unique memories only.
   * @returns A Promise resolving to an array of Memory objects.
   */
  async getMemoriesByIds({
    userIds,
    count = 10,
    unique = true,
  }: {
    userIds: UUID[];
    count?: number;
    unique?: boolean;
  }): Promise<Memory[]> {
    const result = await this.runtime.databaseAdapter.getMemoriesByIds({
      userIds,
      count,
      unique,
      tableName: this.tableName,
    });
    return result;
  }

  async getMemoryByContent(content: string): Promise<SimilaritySearch[]> {
    const result = await this.runtime.databaseAdapter.getMemoryByContent({
      query_table_name: this.tableName,
      query_threshold: 2,
      query_input: content,
      query_field_name: "content",
      query_field_sub_name: "content",
      query_match_count: 10,
    });
    return result;
  }

  /**
   * Searches for memories similar to a given embedding vector.
   * @param embedding The embedding vector to search with.
   * @param opts Options including match threshold, count, user IDs, and uniqueness.
   * @param opts.match_threshold The similarity threshold for matching memories.
   * @param opts.count The maximum number of memories to retrieve.
   * @param opts.userIds An array of user IDs to retrieve memories for.
   * @param opts.unique Whether to retrieve unique memories only.
   * @returns A Promise resolving to an array of Memory objects that match the embedding.
   */
  async searchMemoriesByEmbedding(
    embedding: number[],
    opts: {
      match_threshold?: number;
      count?: number;
      userIds?: UUID[];
      unique?: boolean;
    },
  ): Promise<Memory[]> {
    const {
      match_threshold = defaultMatchThreshold,
      count = defaultMatchCount,
      userIds = [],
      unique,
    } = opts;

    console.log("embedding length to search is", embedding.length);

    console.log("opts are", opts);
    console.log(opts);

    const result = await this.runtime.databaseAdapter.searchMemories({
      tableName: this.tableName,
      userIds: userIds,
      embedding: embedding,
      match_threshold: match_threshold,
      match_count: count,
      unique: !!unique,
    });

    console.log("result.embedding.length", result[0]?.embedding?.length);

    return result;
  }

  /**
   * Creates a new memory in the database, with an option to check for similarity before insertion.
   * @param memory The memory object to create.
   * @param unique Whether to check for similarity before insertion.
   * @returns A Promise that resolves when the operation completes.
   */
  async createMemory(memory: Memory, unique = false): Promise<void> {
    await this.runtime.databaseAdapter.createMemory(
      memory,
      this.tableName,
      unique,
    );
  }

  /**
   * Removes a memory from the database by its ID.
   * @param memoryId The ID of the memory to remove.
   * @returns A Promise that resolves when the operation completes.
   */
  async removeMemory(memoryId: UUID): Promise<void> {
    await this.runtime.databaseAdapter.removeMemory(memoryId, this.tableName);
  }

  /**
   * Removes all memories associated with a set of user IDs.
   * @param userIds An array of user IDs to remove memories for.
   * @returns A Promise that resolves when the operation completes.
   */
  async removeAllMemoriesByUserIds(userIds: UUID[]): Promise<void> {
    await this.runtime.databaseAdapter.removeAllMemoriesByUserIds(
      userIds,
      this.tableName,
    );
  }

  /**
   * Counts the number of memories associated with a set of user IDs, with an option for uniqueness.
   * @param userIds An array of user IDs to count memories for.
   * @param unique Whether to count unique memories only.
   * @returns A Promise resolving to the count of memories.
   */
  async countMemoriesByUserIds(
    userIds: UUID[],
    unique = true,
  ): Promise<number> {
    return await this.runtime.databaseAdapter.countMemoriesByUserIds(
      userIds,
      unique,
      this.tableName,
    );
  }
}
