// Matter API Client
// Docs: https://matter-d988c870.mintlify.app/api-reference/introduction

// --- Types ---

export interface Author {
  object: "author";
  id: string;
  name: string;
}

export interface RateLimit {
  read: number;
  write: number;
  save: number;
  markdown: number;
  burst: number;
}

export interface Item {
  object: "item";
  id: string;
  title: string;
  url: string;
  site_name: string | null;
  author: Author | null;
  content_type: "article" | "podcast" | "video" | "pdf" | "tweet" | "newsletter";
  status: "inbox" | "queue" | "archive";
  processing_status: "processing" | "completed" | "failed";
  is_favorite: boolean;
  reading_progress: number;
  word_count: number | null;
  image_url: string | null;
  excerpt: string | null;
  markdown: string | null;
  library_position: number | null;
  inbox_position: number | null;
  tags: Tag[];
  saved_at: string;
  updated_at: string;
}

export interface Annotation {
  object: "annotation";
  id: string;
  item_id: string;
  text: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  object: "tag";
  id: string;
  name: string;
  item_count: number;
  created_at: string;
}

export interface Account {
  object: "account";
  id: string;
  name: string;
  email: string;
  rate_limit: RateLimit;
  created_at: string;
}

export interface PaginatedList<T> {
  object: "list";
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

// --- Filter types ---

export interface ItemFilters {
  status?: "inbox" | "queue" | "archive" | "all";
  is_favorite?: boolean;
  tag?: string;
  content_type?: "article" | "podcast" | "video" | "pdf" | "tweet" | "newsletter";
  order?: "updated" | "library_position" | "inbox_position";
  updated_since?: string;
  limit?: number;
  cursor?: string;
}

export interface AnnotationFilters {
  item_id: string;
  limit?: number;
  cursor?: string;
}

export interface SaveItemInput {
  url: string;
  status?: "queue" | "archive";
}

export interface UpdateItemInput {
  status?: "queue" | "archive";
  is_favorite?: boolean;
  reading_progress?: number;
}

export interface UpdateAnnotationInput {
  note: string | null;
}

// --- Client ---

export class MatterAPIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "MatterAPIError";
  }
}

export class MatterAPI {
  constructor(
    private token: string,
    private baseUrl: string = "https://api.getmatter.com/public/v1",
  ) {}

  private async request<T>(
    method: string,
    path: string,
    options?: { params?: Record<string, string>; body?: unknown },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      let code = "unknown_error";
      let message = `HTTP ${res.status}`;
      let field: string | undefined;
      try {
        const errBody = (await res.json()) as { error: { code: string; message: string; field?: string } };
        code = errBody.error?.code || code;
        message = errBody.error?.message || message;
        field = errBody.error?.field ?? undefined;
      } catch {
        // Use defaults
      }
      throw new MatterAPIError(res.status, code, message, field);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  // --- Account ---

  async getAccount(): Promise<Account> {
    return this.request<Account>("GET", "/me");
  }

  // --- Items ---

  async listItems(filters?: ItemFilters): Promise<PaginatedList<Item>> {
    const params: Record<string, string> = {};
    if (filters?.status && filters.status !== "all") params.status = filters.status;
    if (filters?.is_favorite !== undefined) params.is_favorite = String(filters.is_favorite);
    if (filters?.tag) params.tag = filters.tag;
    if (filters?.content_type) params.content_type = filters.content_type;
    if (filters?.order) params.order = filters.order;
    if (filters?.updated_since) params.updated_since = filters.updated_since;
    if (filters?.limit) params.limit = String(filters.limit);
    if (filters?.cursor) params.cursor = filters.cursor;
    return this.request<PaginatedList<Item>>("GET", "/items", { params });
  }

  async getItem(id: string, include?: string): Promise<Item> {
    const params: Record<string, string> = {};
    if (include) params.include = include;
    return this.request<Item>("GET", `/items/${id}`, { params });
  }

  async saveItem(data: SaveItemInput): Promise<Item> {
    return this.request<Item>("POST", "/items", { body: data });
  }

  async updateItem(id: string, data: UpdateItemInput): Promise<Item> {
    return this.request<Item>("PATCH", `/items/${id}`, { body: data });
  }

  async deleteItem(id: string): Promise<void> {
    return this.request<void>("DELETE", `/items/${id}`);
  }

  // --- Annotations ---
  // Annotations are scoped to items: GET /v1/items/{item_id}/annotations

  async listAnnotations(filters: AnnotationFilters): Promise<PaginatedList<Annotation>> {
    const params: Record<string, string> = {};
    if (filters.limit) params.limit = String(filters.limit);
    if (filters.cursor) params.cursor = filters.cursor;
    return this.request<PaginatedList<Annotation>>("GET", `/items/${filters.item_id}/annotations`, { params });
  }

  async getAnnotation(id: string): Promise<Annotation> {
    return this.request<Annotation>("GET", `/annotations/${id}`);
  }

  async updateAnnotation(id: string, data: UpdateAnnotationInput): Promise<Annotation> {
    return this.request<Annotation>("PATCH", `/annotations/${id}`, { body: data });
  }

  async deleteAnnotation(id: string): Promise<void> {
    return this.request<void>("DELETE", `/annotations/${id}`);
  }

  // --- Tags ---

  async listTags(opts?: { limit?: number; cursor?: string }): Promise<PaginatedList<Tag>> {
    const params: Record<string, string> = {};
    if (opts?.limit) params.limit = String(opts.limit);
    if (opts?.cursor) params.cursor = opts.cursor;
    return this.request<PaginatedList<Tag>>("GET", "/tags", { params });
  }

  async renameTag(id: string, name: string): Promise<Tag> {
    return this.request<Tag>("PATCH", `/tags/${id}`, { body: { name } });
  }

  async deleteTag(id: string): Promise<void> {
    return this.request<void>("DELETE", `/tags/${id}`);
  }

  // Tag-item operations are scoped to items: POST/DELETE /v1/items/{item_id}/tags
  async addTagToItem(itemId: string, tagName: string): Promise<Tag> {
    return this.request<Tag>("POST", `/items/${itemId}/tags`, { body: { name: tagName } });
  }

  async removeTagFromItem(itemId: string, tagId: string): Promise<void> {
    return this.request<void>("DELETE", `/items/${itemId}/tags/${tagId}`);
  }

  // --- Pagination helper ---

  async listAll<T>(
    fetcher: (cursor?: string) => Promise<PaginatedList<T>>,
  ): Promise<T[]> {
    const all: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await fetcher(cursor);
      all.push(...page.results);
      cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return all;
  }
}
