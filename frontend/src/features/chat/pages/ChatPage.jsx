import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import AppShell from "@/shared/layout/AppShell";
import MessageBubble from "@/features/chat/components/MessageBubble";
import Composer from "@/features/chat/components/Composer";
import { Button } from "@/shared/ui/button";
import { fetchModels } from "@/features/models/store/modelsSlice";

export default function ChatPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const { messages, draftAssistant, streaming } = useSelector((s) => s.chat);
  const { status, error, errorCode, provider } = useSelector((s) => s.models);

  useEffect(() => {
    dispatch(fetchModels());
  }, [dispatch]);

  useEffect(() => {
    if (errorCode === 401) navigate("/login");
  }, [errorCode, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draftAssistant]);

  const ready = status === "ready";

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 pb-6">
        {status === "loading" ? (
          <p className="text-center text-sm text-muted-foreground">
            Connecting to model provider…
          </p>
        ) : null}

        {status === "error" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">
              {errorCode === 503
                ? provider === "ollama"
                  ? "Ollama isn't running."
                  : "AI provider unreachable."
                : "Something went wrong."}
            </p>
            <p className="mt-1 text-muted-foreground">
              {errorCode === 503
                ? provider === "ollama"
                  ? "Start it with ollama serve, then retry."
                  : "Check AI_GRID_BASE_URL / API key in .env, then retry."
                : error}
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              size="sm"
              onClick={() => dispatch(fetchModels())}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {ready ? (
          <>
            <div className="min-h-[40vh] flex-1 overflow-y-auto rounded-xl border border-border/60 bg-black/10 p-4">
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
                    role={m.role}
                    content={m.content}
                    thinking={m.thinking}
                  />
                ))}
                {draftAssistant ? (
                  <MessageBubble
                    role="assistant"
                    content={draftAssistant.content}
                    thinking={draftAssistant.thinking}
                    error={draftAssistant.error}
                    streaming={streaming}
                  />
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>
            <Composer />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
