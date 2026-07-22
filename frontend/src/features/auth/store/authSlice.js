import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiJson } from "@/shared/api/client";

function detailMessage(data, fallback) {
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length) {
    return data.detail[0].msg || fallback;
  }
  return fallback;
}

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    const { ok, status, data } = await apiJson("/api/me");
    if (status === 401) return rejectWithValue("unauthenticated");
    if (!ok) return rejectWithValue(detailMessage(data, "Failed to load user"));
    return data;
  },
);

export const login = createAsyncThunk(
  "auth/login",
  async ({ username, password }, { rejectWithValue }) => {
    const { ok, data } = await apiJson("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!ok) return rejectWithValue(detailMessage(data, "Login failed"));
    return data;
  },
);

export const signup = createAsyncThunk(
  "auth/signup",
  async (payload, { dispatch, rejectWithValue }) => {
    const { ok, data } = await apiJson("/api/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!ok) return rejectWithValue(detailMessage(data, "Signup failed"));

    const loginResult = await dispatch(
      login({ username: payload.username, password: payload.password }),
    );
    if (login.rejected.match(loginResult)) {
      return rejectWithValue(
        loginResult.payload || "Account created — please sign in",
      );
    }
    return loginResult.payload;
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await apiJson("/api/logout", { method: "POST" });
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    status: "idle",
    error: null,
  },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(login.pending, (state) => {
        state.error = null;
        state.status = "loading";
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = {
          username: action.payload.username,
          first_name: action.payload.first_name,
          last_name: action.payload.last_name || "",
        };
        state.status = "authenticated";
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "anonymous";
        state.error = action.payload || "Login failed";
      })
      .addCase(signup.pending, (state) => {
        state.error = null;
        state.status = "loading";
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.user = {
          username: action.payload.username,
          first_name: action.payload.first_name,
          last_name: action.payload.last_name || "",
        };
        state.status = "authenticated";
      })
      .addCase(signup.rejected, (state, action) => {
        state.status = "anonymous";
        state.error = action.payload || "Signup failed";
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = "anonymous";
        state.error = null;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
