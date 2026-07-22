import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/store/authSlice";
import modelsReducer from "@/features/models/store/modelsSlice";
import chatReducer from "@/features/chat/store/chatSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    models: modelsReducer,
    chat: chatReducer,
  },
});
