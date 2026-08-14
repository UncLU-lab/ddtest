// API client for the demurrage dashboard backend
export const API_BASE = "http://localhost:3000/api/v1";

type ApiError = {
  message: string;
  status?: number;
};

type ApiResponse<T> = {
  data: T;
};

export async function getVoyages(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/voyages`);

    if (!response.ok) {
      throw {
        message: `API request failed: ${response.statusText}`,
        status: response.status
      };
    }

    const result = await response.json();
    return Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Failed to fetch voyages:', error);
    throw error; // Re-throw to let caller handle
  }
}

// Other API endpoints can be added here as needed