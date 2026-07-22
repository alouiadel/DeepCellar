import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import AppShell from "@/shared/layout/AppShell";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { fetchModels } from "@/features/models/store/modelsSlice";

function ModelCard({ model }) {
  let host = null;
  if (model.cloud && model.remote_host) {
    try {
      host = new URL(model.remote_host).hostname;
    } catch {
      host = model.remote_host;
    }
  }

  return (
    <Card
      className={
        model.chatable ? "shadow-md" : "opacity-60 shadow-md grayscale-[0.3]"
      }
    >
      <CardContent className="space-y-3 p-4">
        <div className="font-medium break-all">{model.name}</div>
        <div className="flex flex-wrap gap-1.5">
          {!model.chatable ? (
            <Badge variant="danger">⊘ not chatable</Badge>
          ) : null}
          {model.thinking ? <Badge variant="thinking">✦ Thinking</Badge> : null}
          {model.cloud ? <Badge variant="cloud">☁ Cloud</Badge> : null}
          {(model.capabilities || [])
            .filter((c) => ["vision", "tools", "embedding"].includes(c))
            .map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {model.parameter_size ? (
            <>
              <dt>Parameters</dt>
              <dd className="text-foreground">{model.parameter_size}</dd>
            </>
          ) : null}
          {model.quantization ? (
            <>
              <dt>Quantization</dt>
              <dd className="text-foreground">{model.quantization}</dd>
            </>
          ) : null}
          {model.family ? (
            <>
              <dt>Family</dt>
              <dd className="text-foreground">{model.family}</dd>
            </>
          ) : null}
          {model.context_length ? (
            <>
              <dt>Context</dt>
              <dd className="text-foreground">
                {model.context_length.toLocaleString()} tokens
              </dd>
            </>
          ) : null}
          {!model.cloud && model.size_bytes ? (
            <>
              <dt>Size</dt>
              <dd className="text-foreground">
                {(model.size_bytes / 1e9).toFixed(1)} GB
              </dd>
            </>
          ) : null}
          {host ? (
            <>
              <dt>Host</dt>
              <dd className="text-foreground">{host}</dd>
            </>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function Group({ title, models }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({models.length})
        </span>
      </h2>
      {models.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <ModelCard key={m.name} model={m} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} models found.
        </p>
      )}
    </section>
  );
}

export default function ModelsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { cloud, local, status, error, errorCode, provider } = useSelector(
    (s) => s.models,
  );

  useEffect(() => {
    dispatch(fetchModels());
  }, [dispatch]);

  useEffect(() => {
    if (errorCode === 401) navigate("/login");
  }, [errorCode, navigate]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
        <h1 className="text-2xl font-semibold">Available models</h1>

        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">
            Connecting to model provider…
          </p>
        ) : null}

        {status === "error" && errorCode !== "empty" ? (
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

        {status === "ready" || errorCode === "empty" ? (
          <>
            <Group title="Cloud" models={cloud} />
            <Group title="Local" models={local} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
