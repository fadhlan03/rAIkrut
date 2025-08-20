"use client";

import { ReactNode } from "react";
import { useLoggerStore, StreamingLog } from "@/lib/store-logger";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs2015 as dark } from "react-syntax-highlighter/dist/esm/styles/hljs";

const formatTime = (d: Date) => d.toLocaleTimeString().slice(0, -3);

const LogEntry = ({
  log,
  MessageComponent,
}: {
  log: StreamingLog;
  MessageComponent: ({
    message,
  }: {
    message: StreamingLog["message"];
  }) => ReactNode | null;
}): React.ReactNode | null => {
  const sourceType = log.type.slice(0, log.type.indexOf('.'));
  let sourceColorClass = "";
  let sourceStyleClass = "";
  if (sourceType === "server" || log.type.includes("receive")) {
    sourceColorClass = "text-blue-500";
  } else if (sourceType === "client" || log.type.includes("send")) {
    sourceColorClass = "text-green-500";
  }
  if (log.type.includes("receive")) sourceStyleClass += " receive";
  if (log.type.includes("send")) sourceStyleClass += " send";

  return (
    <div className={`flex flex-row px-4 py-2 border-b border-gray-200 ${sourceStyleClass}`}>
      <div className="w-20 text-xs text-gray-500">
        {formatTime(log.date)}
      </div>
      <div className={`w-28 text-xs font-mono ${sourceColorClass}`}>
        {log.type}
        {log.count && log.count > 1 && (
          <span className="text-gray-400 ml-1">x{log.count}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <MessageComponent message={log.message} />
      </div>
    </div>
  );
};

// Simple message component for ElevenLabs logs
const SimpleMessage = ({ message }: { message: any }) => {
  if (typeof message === "string") {
    return <div className="text-sm text-gray-700">{message}</div>;
  }

  if (typeof message === "object" && message !== null) {
    try {
      const jsonString = JSON.stringify(message, null, 2);
      return (
        <div className="text-xs">
          <SyntaxHighlighter
            language="json"
            style={dark}
            customStyle={{
              background: "transparent",
              padding: "8px",
              margin: 0,
              fontSize: "11px",
              lineHeight: "1.3",
            }}
            showLineNumbers={false}
            wrapLines={true}
            wrapLongLines={true}
          >
            {jsonString}
          </SyntaxHighlighter>
        </div>
      );
    } catch (error) {
      return <div className="text-sm text-gray-700">{String(message)}</div>;
    }
  }

  return <div className="text-sm text-gray-700">{String(message)}</div>;
};

function LoggerComponent() {
  const { logs } = useLoggerStore();

  if (!logs.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-sm">No logs yet</div>
          <div className="text-xs mt-1">Conversation events will appear here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white overflow-auto">
      <div className="divide-y divide-gray-200">
        {logs.map((log, index) => (
          <LogEntry
            key={`${log.type}-${index}-${log.date.getTime()}`}
            log={log}
            MessageComponent={SimpleMessage}
          />
        ))}
      </div>
    </div>
  );
}

export default LoggerComponent;
