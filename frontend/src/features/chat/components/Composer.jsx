import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowUp } from "lucide-react";
import { sendMessage } from "@/features/chat/store/chatSlice";
import { Button } from "@/shared/ui/button";
import ModelPicker from "./ModelPicker";

export default function Composer() {
  const dispatch = useDispatch();
  const streaming = useSelector((s) => s.chat.streaming);
  const selectedModel = useSelector((s) => s.models.selectedModel);
  const [text, setText] = useState("");

  const canSend = !!text.trim() && !!selectedModel && !streaming;

  function submit() {
    if (!canSend) return;
    const value = text;
    setText("");
    dispatch(sendMessage({ text: value }));
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-3 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Message… (Enter to send, Shift+Enter for a new line)"
        className="mb-2 max-h-40 w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        disabled={streaming}
      />
      <div className="flex items-center justify-between gap-2">
        <ModelPicker disabled={streaming} />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="rounded-full"
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
