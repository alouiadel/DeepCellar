import { useDispatch, useSelector } from "react-redux";
import { ChevronDown } from "lucide-react";
import { selectModel } from "@/features/models/store/modelsSlice";
import { clearChat } from "@/features/chat/store/chatSlice";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export default function ModelPicker({ disabled }) {
  const dispatch = useDispatch();
  const { cloud, local, selectedModel, chatable } = useSelector(
    (s) => s.models,
  );
  const selected = chatable.find((m) => m.name === selectedModel);

  function onSelect(name) {
    if (name === selectedModel) return;
    dispatch(selectModel(name));
    dispatch(clearChat());
  }

  const groups = [
    ["Cloud", cloud.filter((m) => m.chatable)],
    ["Local", local.filter((m) => m.chatable)],
  ].filter(([, list]) => list.length);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || !chatable.length}
          className="max-w-[220px] justify-between gap-2"
        >
          <span className="truncate">
            {selected
              ? `${selected.name}${selected.thinking ? " ✦" : ""}`
              : "Select model"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
        {groups.map(([label, list], idx) => (
          <div key={label}>
            {idx > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {list.map((m) => (
              <DropdownMenuItem
                key={m.name}
                onSelect={() => onSelect(m.name)}
                className="flex flex-col items-start gap-0.5"
              >
                <span>
                  {m.name}
                  {m.thinking ? " ✦" : ""}
                </span>
                {m.parameter_size ? (
                  <span className="text-xs text-muted-foreground">
                    {m.parameter_size}
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
