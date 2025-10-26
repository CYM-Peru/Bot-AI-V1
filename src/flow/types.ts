export type NodeType = "menu" | "action";

export type ActionKind =
  | "message"
  | "buttons"
  | "attachment"
  | "webhook_out"
  | "webhook_in"
  | "transfer"
  | "handoff"
  | "ia_rag"
  | "tool"
  | "ask"
  | "scheduler";

export type MenuOption = {
  id: string;
  label: string;
  value?: string;
  targetId?: string | null;
};

export type ButtonOption = {
  id: string;
  label: string;
  value: string;
  targetId?: string | null;
};

export type ButtonsActionData = {
  items: ButtonOption[];
  maxButtons: number;
  moreTargetId: string | null;
};

export type AskValidation =
  | { type: "none" }
  | { type: "regex"; pattern: string }
  | { type: "options"; options: string[] };

export type AskActionData = {
  questionText: string;
  varName: string;
  varType: "text" | "number" | "option";
  validation: AskValidation;
  retryMessage?: string;
  answerTargetId: string | null;
  invalidTargetId: string | null;
};

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TimeWindow {
  weekdays: Weekday[];
  start: string;
  end: string;
  overnight?: boolean;
}

export interface DateException {
  date: string;
  closed?: boolean;
  start?: string;
  end?: string;
}

export interface CustomSchedule {
  timezone: string;
  windows: TimeWindow[];
  exceptions?: DateException[];
}

export type SchedulerMode = "custom" | "bitrix";

export interface SchedulerNodeData {
  mode: SchedulerMode;
  custom?: CustomSchedule;
  inWindowTargetId: string | null;
  outOfWindowTargetId: string | null;
}

export type FlowAction = {
  kind: ActionKind;
  data?: Record<string, any>;
};

export type FlowNode = {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
  action?: FlowAction;
  menuOptions?: MenuOption[];
  children: string[];
};

export type Flow = {
  version: number;
  id: string;
  name: string;
  rootId: string;
  nodes: Record<string, FlowNode>;
};

export type OutputHandle = {
  id: string;
  label: string;
  side: "left" | "right";
  type: "input" | "output";
  order: number;
};

export type ChannelKey = "whatsapp" | "facebook" | "telegram" | "web";

export type ChannelButtonLimit = {
  channel: ChannelKey;
  max: number;
  source: string;
  note?: string;
};
