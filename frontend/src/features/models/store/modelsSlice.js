import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiJson } from "@/shared/api/client";

const MODEL_KEY = "deepcellar_model";

export const fetchModels = createAsyncThunk(
  "models/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const [cfgRes, modelsRes] = await Promise.all([
        apiJson("/api/me/config"),
        apiJson("/api/models"),
      ]);

      if (modelsRes.status === 401) {
        return rejectWithValue({ code: 401, message: "unauthenticated" });
      }
      if (modelsRes.status === 503) {
        const provider = cfgRes.ok ? cfgRes.data.provider : "ollama";
        return rejectWithValue({
          code: 503,
          message: "provider_down",
          provider,
        });
      }
      if (!modelsRes.ok) {
        return rejectWithValue({
          code: modelsRes.status,
          message: `Unexpected server error (${modelsRes.status}).`,
        });
      }

      return {
        ...modelsRes.data,
        provider:
          modelsRes.data.provider ||
          (cfgRes.ok ? cfgRes.data.provider : "ollama"),
        defaultModel: cfgRes.ok ? cfgRes.data.default_model : null,
      };
    } catch {
      return rejectWithValue({
        code: 0,
        message: "Could not reach the DeepCellar server.",
      });
    }
  },
);

const modelsSlice = createSlice({
  name: "models",
  initialState: {
    cloud: [],
    local: [],
    chatable: [],
    provider: "ollama",
    defaultModel: null,
    selectedModel: null,
    status: "idle",
    error: null,
    errorCode: null,
  },
  reducers: {
    selectModel(state, action) {
      state.selectedModel = action.payload;
      if (action.payload) {
        localStorage.setItem(MODEL_KEY, action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchModels.pending, (state) => {
        state.status = "loading";
        state.error = null;
        state.errorCode = null;
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        const cloud = action.payload.cloud || [];
        const local = action.payload.local || [];
        const chatable = [...cloud, ...local].filter((m) => m.chatable);
        state.cloud = cloud;
        state.local = local;
        state.chatable = chatable;
        state.provider = action.payload.provider || "ollama";
        state.defaultModel = action.payload.defaultModel || null;
        state.status = chatable.length ? "ready" : "error";
        state.error = chatable.length
          ? null
          : "No chat-capable models found for this provider.";
        state.errorCode = chatable.length ? null : "empty";

        const saved = localStorage.getItem(MODEL_KEY);
        const initial = chatable.some((m) => m.name === saved)
          ? saved
          : chatable.some((m) => m.name === state.defaultModel)
            ? state.defaultModel
            : chatable[0]?.name || null;
        state.selectedModel = initial;
        if (initial) localStorage.setItem(MODEL_KEY, initial);
      })
      .addCase(fetchModels.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload?.message || "Failed to load models";
        state.errorCode = action.payload?.code ?? "error";
        if (action.payload?.provider) {
          state.provider = action.payload.provider;
        }
      });
  },
});

export const { selectModel } = modelsSlice.actions;
export default modelsSlice.reducer;
