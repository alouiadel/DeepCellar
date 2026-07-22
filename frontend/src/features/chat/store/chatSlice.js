import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    streaming: false,
    draftAssistant: null,
  },
  reducers: {
    clearChat(state) {
      state.messages = [];
      state.draftAssistant = null;
      state.streaming = false;
    },
    pushUser(state, action) {
      state.messages.push({ role: "user", content: action.payload });
    },
    beginAssistant(state) {
      state.streaming = true;
      state.draftAssistant = { content: "", thinking: "", error: null };
    },
    patchAssistant(state, action) {
      if (!state.draftAssistant) return;
      state.draftAssistant.content = action.payload.content;
      state.draftAssistant.thinking = action.payload.thinking || "";
    },
    finishAssistant(state, action) {
      const msg = { role: "assistant", content: action.payload.content };
      if (action.payload.thinking) msg.thinking = action.payload.thinking;
      state.messages.push(msg);
      state.draftAssistant = null;
      state.streaming = false;
    },
    failTurn(state, action) {
      if (state.messages.at(-1)?.role === "user") {
        state.messages.pop();
      }
      state.draftAssistant = {
        content: "",
        thinking: "",
        error: action.payload || "Failed",
      };
      state.streaming = false;
    },
    dismissErrorBubble(state) {
      state.draftAssistant = null;
    },
  },
});

export const {
  clearChat,
  pushUser,
  beginAssistant,
  patchAssistant,
  finishAssistant,
  failTurn,
  dismissErrorBubble,
} = chatSlice.actions;

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ text }, { getState, dispatch, rejectWithValue }) => {
    const state = getState();
    const modelName = state.models.selectedModel;
    const model = state.models.chatable.find((m) => m.name === modelName);
    if (!model || !text.trim()) {
      return rejectWithValue("Nothing to send");
    }

    const history = [
      ...state.chat.messages,
      { role: "user", content: text.trim() },
    ];
    dispatch(pushUser(text.trim()));
    dispatch(beginAssistant());

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.name,
          messages: history,
          think: !!model.thinking,
        }),
      });

      if (res.status === 401) {
        dispatch(failTurn("Not authenticated"));
        return rejectWithValue("unauthenticated");
      }
      if (!res.ok || !res.body) {
        dispatch(failTurn(`Server error ${res.status}`));
        return rejectWithValue(`Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let thinking = "";
      let errored = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }
          if (chunk.error) {
            errored = true;
            dispatch(failTurn(chunk.error));
            continue;
          }
          if (chunk.message?.thinking) {
            thinking += chunk.message.thinking;
            dispatch(patchAssistant({ content, thinking }));
          }
          if (chunk.message?.content) {
            content += chunk.message.content;
            dispatch(patchAssistant({ content, thinking }));
          }
        }
      }

      if (errored || !content) {
        if (!errored) dispatch(failTurn("Empty response"));
        return rejectWithValue("turn_failed");
      }

      dispatch(finishAssistant({ content, thinking }));
      return { content, thinking };
    } catch (err) {
      dispatch(failTurn(err.message || "Connection failed."));
      return rejectWithValue(err.message || "Connection failed.");
    }
  },
);

export default chatSlice.reducer;
