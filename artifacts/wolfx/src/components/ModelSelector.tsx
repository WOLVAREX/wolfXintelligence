import { useState } from "react";
import { useListModels } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Cpu, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  primaryModelId?: number;
  selectedModelIds: number[];
  onSelectionChange: (ids: number[]) => void;
  maxExtra?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  code: "Code",
  chat: "Chat",
  reasoning: "Reasoning",
  vision: "Vision",
};

export default function ModelSelector({
  primaryModelId,
  selectedModelIds,
  onSelectionChange,
  maxExtra = 3,
}: ModelSelectorProps) {
  const { data: models } = useListModels();
  const [open, setOpen] = useState(false);

  const selectedModels = models?.filter((m) => selectedModelIds.includes(m.id)) ?? [];
  const primaryModel = models?.find((m) => m.id === primaryModelId);

  const toggleModel = (modelId: number) => {
    if (modelId === primaryModelId) return;
    if (selectedModelIds.includes(modelId)) {
      onSelectionChange(selectedModelIds.filter((id) => id !== modelId));
    } else {
      if (selectedModelIds.length >= maxExtra + 1) return;
      onSelectionChange([...selectedModelIds, modelId]);
    }
  };

  const categories = ["code", "chat", "reasoning", "vision"];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30"
        >
          <Cpu className="w-3.5 h-3.5" />
          {primaryModel ? (
            <span className="max-w-[80px] truncate">{primaryModel.name}</span>
          ) : (
            <span>Models</span>
          )}
          {selectedModelIds.length > 1 && (
            <Badge className="h-4 px-1 text-[9px]">+{selectedModelIds.length - 1}</Badge>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 p-0 border-border bg-card"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Select Models</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Primary + up to {maxExtra} additional for multi-model mode
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto p-2 space-y-3">
          {categories.map((cat) => {
            const catModels = models?.filter((m) => m.category === cat && m.isEnabled) ?? [];
            if (!catModels.length) return null;
            return (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-2 mb-1">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                {catModels.map((model) => {
                  const isPrimary = model.id === primaryModelId;
                  const isSelected = selectedModelIds.includes(model.id);
                  const isDisabled = !isPrimary && !isSelected && selectedModelIds.length >= maxExtra + 1;
                  return (
                    <button
                      key={model.id}
                      onClick={() => toggleModel(model.id)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left transition-colors text-xs",
                        isSelected ? "bg-primary/10" : "hover:bg-secondary",
                        isDisabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-border"
                      )}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <span className="flex-1 truncate font-medium">{model.name}</span>
                      {isPrimary && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 flex-shrink-0">primary</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        {selectedModelIds.length > 1 && (
          <div className="p-2 border-t border-border">
            <div className="flex flex-wrap gap-1">
              {selectedModels.map((m) => (
                <Badge key={m.id} variant={m.id === primaryModelId ? "default" : "secondary"} className="text-[10px]">
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
