import { useRuntimeConfig } from "nuxt/app";
import { useAuthStore } from "@/stores/authStore";

export const useApi = () => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl;
  const authStore = useAuthStore();

  const getHeaders = (requireAuth: boolean = false) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (requireAuth && authStore.token) {
      headers["Authorization"] = `Bearer ${authStore.token}`;
    }
    return headers;
  };

  const handleResponse = async (response: Response) => {
    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, ...errorData };
    }
    return response.json();
  };

  const get = async (url: string, requireAuth: boolean = false) => {
    try {
      const response = await fetch(`${apiUrl}${url}`, {
        headers: getHeaders(requireAuth),
      });
      return await handleResponse(response);
    } catch (error) {
      throw error;
    }
  };

  const post = async (url: string, data: any, requireAuth: boolean = false) => {
    try {
      const response = await fetch(`${apiUrl}${url}`, {
        method: "POST",
        headers: getHeaders(requireAuth),
        body: JSON.stringify(data),
      });
      return await handleResponse(response);
    } catch (error) {
      throw error;
    }
  };

  const sendForm = async (
    url: string,
    formData: FormData,
    requireAuth: boolean = false,
    method: "POST" | "PUT" = "POST",
  ) => {
    const headers = getHeaders(requireAuth);
    delete headers["Content-Type"]; // Laisser le navigateur définir le bon Content-Type pour FormData

    const response = await fetch(`${apiUrl}${url}`, {
      method: method,
      headers: headers,
      body: formData,
    });
    return await handleResponse(response);
  };

  const put = async (url: string, data: any, requireAuth: boolean = false) => {
    try {
      const response = await fetch(`${apiUrl}${url}`, {
        method: "PUT",
        headers: getHeaders(requireAuth),
        body: JSON.stringify(data),
      });
      return await handleResponse(response);
    } catch (error) {
      throw error;
    }
  };

  const deleteRequest = async (url: string, requireAuth: boolean = false) => {
    try {
      const response = await fetch(`${apiUrl}${url}`, {
        method: "DELETE",
        headers: getHeaders(requireAuth),
      });
      return await handleResponse(response);
    } catch (error) {
      throw error;
    }
  };

  return {
    get,
    post,
    sendForm,
    put,
    deleteRequest,
  };
};
