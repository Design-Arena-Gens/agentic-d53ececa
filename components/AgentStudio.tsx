"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AgentProfile = {
  id: string;
  name: string;
  role: string;
  expertise: string;
  greeting: string;
  voiceName: string;
  color: string;
};

type Message = {
  id: string;
  sender: "user" | "agent";
  text: string;
  createdAt: number;
};

const COLORS = ["#6c5ce7", "#00cec9", "#fd79a8"];

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: "connor",
    name: "Connor",
    role: "Strategy Architect",
    expertise: "Growth roadmaps, product positioning, partner orchestration",
    greeting: "Let's map the path to sustainable growth together.",
    voiceName: "",
    color: COLORS[0]
  },
  {
    id: "lyra",
    name: "Lyra",
    role: "Conversational UX Designer",
    expertise: "Dialog flows, persona crafting, empathetic interactions",
    greeting: "I'm here to help design delightful voice journeys.",
    voiceName: "",
    color: COLORS[1]
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Systems Navigator",
    expertise: "API orchestration, tool integrations, reliability guardrails",
    greeting: "Let's make your agent dependable and responsive end-to-end.",
    voiceName: "",
    color: COLORS[2]
  }
];

const useSpeechVoices = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
      return;
    }

    const handleVoicesChanged = () => {
      const nextVoices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("en"));
      setVoices(nextVoices.length ? nextVoices : window.speechSynthesis.getVoices());
    };

    handleVoicesChanged();
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, []);

  return voices;
};

const AgentStudio: React.FC = () => {
  const [agents, setAgents] = useState<AgentProfile[]>(DEFAULT_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string>(DEFAULT_AGENTS[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [listeningError, setListeningError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voices = useSpeechVoices();

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? agents[0],
    [agents, activeAgentId]
  );

  const assignVoice = (agent: AgentProfile) => {
    if (!voices.length) {
      return agent.voiceName;
    }

    if (agent.voiceName) {
      return agent.voiceName;
    }

    const voice = voices.find((candidate) =>
      candidate.name.toLowerCase().includes(agent.name.slice(0, 2).toLowerCase())
    );
    return voice?.name ?? voices[0]?.name ?? "";
  };

  useEffect(() => {
    setAgents((prev) =>
      prev.map((agent) => ({
        ...agent,
        voiceName: assignVoice(agent)
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices]);

  useEffect(() => {
    if (messages.length > 0) {
      return;
    }

    if (activeAgent) {
      setMessages([
        {
          id: crypto.randomUUID(),
          sender: "agent",
          text: activeAgent.greeting,
          createdAt: Date.now()
        }
      ]);
    }
  }, [activeAgent, messages.length]);

  const speak = (text: string, voiceName: string) => {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((candidate) => candidate.name === voiceName);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const createRecognition = (): SpeechRecognition | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const recognitionCtor =
      window.webkitSpeechRecognition ?? window.SpeechRecognition ?? webkitSpeechRecognition ?? SpeechRecognition;

    if (!recognitionCtor) {
      return null;
    }

    const recognition = new recognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setDraft(transcript);
      handleSend(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListeningError(event.error);
      setIsListening(false);
    };
    return recognition;
  };

  useEffect(() => {
    recognitionRef.current = createRecognition();
    return () => {
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = (textOverride?: string) => {
    const text = textOverride ?? draft.trim();
    if (!text || !activeAgent) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text,
      createdAt: Date.now()
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");

    const agentReplyText = generateAgentReply(activeAgent, text);
    const agentMessage: Message = {
      id: crypto.randomUUID(),
      sender: "agent",
      text: agentReplyText,
      createdAt: Date.now() + 1
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, agentMessage]);
      speak(agentReplyText, activeAgent.voiceName);
    }, 350);
  };

  const handleAgentUpdate = (agentId: string, patch: Partial<AgentProfile>) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent))
    );
  };

  const handleStartListening = () => {
    if (!recognitionRef.current) {
      setListeningError("Speech recognition is not supported in this browser.");
      return;
    }
    setListeningError(null);
    recognitionRef.current.start();
    setIsListening(true);
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const resetConversation = () => {
    if (!activeAgent) {
      return;
    }
    setMessages([
      {
        id: crypto.randomUUID(),
        sender: "agent",
        text: activeAgent.greeting,
        createdAt: Date.now()
      }
    ]);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "2.5rem",
        gap: "2rem",
        backdropFilter: "blur(24px)"
      }}
    >
      <header style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <div
          style={{
            width: "3.5rem",
            height: "3.5rem",
            borderRadius: "1.5rem",
            background:
              "linear-gradient(135deg, rgba(173, 106, 255, 0.8) 0%, rgba(79, 209, 197, 0.8) 100%)",
            display: "grid",
            placeItems: "center",
            color: "#0b0b15",
            fontWeight: 700,
            fontSize: "1.25rem",
            letterSpacing: "0.08em"
          }}
        >
          VA
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>Voice Agents Studio</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>
            Orchestrate multi-agent voice teams, craft their personas, and prototype conversations instantly.
          </p>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 360px) 1fr",
          gap: "2rem",
          alignItems: "stretch"
        }}
      >
        <AgentSidebar
          agents={agents}
          activeAgentId={activeAgentId}
          onActiveAgentChange={setActiveAgentId}
          onAgentChange={handleAgentUpdate}
          voices={voices}
        />

        <ConversationPanel
          agent={activeAgent}
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          onReset={resetConversation}
          isListening={isListening}
          onStartListening={handleStartListening}
          onStopListening={handleStopListening}
          listeningError={listeningError}
          voices={voices}
          onVoiceChange={(voiceName) =>
            activeAgent && handleAgentUpdate(activeAgent.id, { voiceName })
          }
        />
      </section>
    </main>
  );
};

type AgentSidebarProps = {
  agents: AgentProfile[];
  activeAgentId: string;
  onActiveAgentChange: (id: string) => void;
  onAgentChange: (id: string, patch: Partial<AgentProfile>) => void;
  voices: SpeechSynthesisVoice[];
};

const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  activeAgentId,
  onActiveAgentChange,
  onAgentChange,
  voices
}) => {
  return (
    <aside
      style={{
        background: "rgba(15, 15, 35, 0.85)",
        borderRadius: "1.5rem",
        padding: "1.5rem",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        boxShadow: "0 16px 48px -24px rgba(0, 0, 0, 0.6)"
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 0.75rem 0", fontSize: "1.125rem" }}>Agent Roster</h2>
        <p style={{ margin: 0, opacity: 0.6, fontSize: "0.95rem" }}>
          Configure each agent&apos;s personality, expertise, and default voice.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onActiveAgentChange(agent.id)}
            style={{
              border: "none",
              borderRadius: "1rem",
              padding: "1rem",
              textAlign: "left",
              cursor: "pointer",
              background:
                agent.id === activeAgentId
                  ? `linear-gradient(135deg, ${agent.color} 0%, rgba(255,255,255,0.1) 100%)`
                  : "rgba(255, 255, 255, 0.06)",
              color: "#f5f5f7",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              boxShadow:
                agent.id === activeAgentId
                  ? "0 12px 32px -20px rgba(255, 255, 255, 0.8)"
                  : "none"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.4rem"
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "1rem" }}>{agent.name}</span>
              <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>{agent.role}</span>
            </div>
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>{agent.expertise}</p>
          </button>
        ))}
      </div>

      {agents
        .filter((agent) => agent.id === activeAgentId)
        .map((agent) => (
          <div
            key={agent.id}
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: "1.25rem",
              padding: "1.25rem",
              display: "grid",
              gap: "0.75rem"
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Persona name</span>
              <input
                value={agent.name}
                onChange={(event) => onAgentChange(agent.id, { name: event.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Role</span>
              <input
                value={agent.role}
                onChange={(event) => onAgentChange(agent.id, { role: event.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Expertise</span>
              <textarea
                value={agent.expertise}
                onChange={(event) => onAgentChange(agent.id, { expertise: event.target.value })}
                style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Greeting</span>
              <textarea
                value={agent.greeting}
                onChange={(event) => onAgentChange(agent.id, { greeting: event.target.value })}
                style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Voice</span>
              <select
                value={agent.voiceName}
                onChange={(event) => onAgentChange(agent.id, { voiceName: event.target.value })}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="">System default</option>
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
    </aside>
  );
};

type ConversationPanelProps = {
  agent: AgentProfile | undefined;
  messages: Message[];
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: (text?: string) => void;
  onReset: () => void;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  listeningError: string | null;
  voices: SpeechSynthesisVoice[];
  onVoiceChange: (voiceName: string) => void;
};

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  agent,
  messages,
  draft,
  onDraftChange,
  onSend,
  onReset,
  isListening,
  onStartListening,
  onStopListening,
  listeningError,
  voices,
  onVoiceChange
}) => {
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section
      style={{
        background: "rgba(15, 15, 35, 0.6)",
        borderRadius: "1.5rem",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        overflow: "hidden",
        minHeight: "60vh",
        boxShadow: "0 24px 56px -32px rgba(9, 9, 20, 0.7)"
      }}
    >
      <div
        style={{
          padding: "1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem"
        }}
      >
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h2 style={{ margin: 0 }}>{agent?.name ?? "Agent"}</h2>
          <p style={{ margin: 0, opacity: 0.7, fontSize: "0.95rem" }}>
            {agent
              ? `Role: ${agent.role}. Focus: ${agent.expertise}.`
              : "Select an agent to begin prototyping a dialogue."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              ...pillButtonStyle,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)"
            }}
          >
            Reset
          </button>
          <label
            style={{
              ...pillButtonStyle,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>Voice</span>
            <select
              value={agent?.voiceName ?? ""}
              onChange={(event) => onVoiceChange(event.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#f5f5f7",
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              <option value="">System default</option>
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div
        style={{
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          overflowY: "auto"
        }}
      >
        {messages.map((message) => (
          <article
            key={message.id}
            style={{
              alignSelf: message.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "70%",
              background:
                message.sender === "user" ? "rgba(126, 214, 223, 0.15)" : "rgba(255,255,255,0.08)",
              borderRadius:
                message.sender === "user" ? "1.15rem 1.15rem 0.35rem 1.15rem" : "1.15rem 1.15rem 1.15rem 0.35rem",
              padding: "1rem",
              border:
                message.sender === "user"
                  ? "1px solid rgba(126, 214, 223, 0.2)"
                  : "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow:
                message.sender === "user"
                  ? "0 12px 32px -24px rgba(126, 214, 223, 0.6)"
                  : "0 12px 32px -24px rgba(255,255,255,0.5)",
              whiteSpace: "pre-wrap",
              lineHeight: "1.4"
            }}
          >
            <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.6, marginBottom: "0.35rem" }}>
              {message.sender === "user" ? "You" : agent?.name ?? "Agent"}
            </span>
            {message.text}
          </article>
        ))}
        <div ref={messageEndRef} />
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "1.5rem",
          display: "grid",
          gap: "0.75rem"
        }}
      >
        {listeningError && (
          <div
            role="status"
            style={{
              background: "rgba(255,82,82,0.1)",
              borderRadius: "0.9rem",
              padding: "0.75rem",
              color: "#ff9b9b",
              fontSize: "0.85rem"
            }}
          >
            {listeningError}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={isListening ? onStopListening : onStartListening}
            style={{
              ...pillButtonStyle,
              background: isListening ? "rgba(255, 104, 91, 0.2)" : "rgba(126, 214, 223, 0.2)",
              border: "1px solid rgba(255,255,255,0.18)",
              minWidth: "6rem",
              fontWeight: 600
            }}
          >
            {isListening ? "Stop" : "Speak"}
          </button>

          <div
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "1rem",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "0.75rem 1rem"
            }}
          >
            <input
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              placeholder="Design a turn in the conversation..."
              style={{
                background: "transparent",
                border: "none",
                color: "#f5f5f7",
                width: "100%",
                fontSize: "1rem",
                outline: "none"
              }}
            />
            <button
              type="button"
              onClick={() => onSend()}
              style={{
                ...pillButtonStyle,
                background: "linear-gradient(135deg, rgba(126, 214, 223,0.45), rgba(171, 148, 255,0.45))",
                border: "1px solid rgba(255,255,255,0.08)",
                paddingInline: "1.25rem",
                fontWeight: 600
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "0.9rem",
  padding: "0.65rem 0.9rem",
  color: "#f5f5f7",
  fontSize: "0.95rem",
  outline: "none"
};

const pillButtonStyle: React.CSSProperties = {
  borderRadius: "999px",
  padding: "0.55rem 1.1rem",
  background: "rgba(255,255,255,0.08)",
  color: "#f5f5f7",
  border: "none",
  cursor: "pointer",
  transition: "transform 0.18s ease, background 0.18s ease"
};

function generateAgentReply(agent: AgentProfile, input: string): string {
  const normalizedInput = input.trim().toLowerCase();

  if (normalizedInput.includes("hello") || normalizedInput.includes("hi")) {
    return `${agent.name}: ${agent.greeting}`;
  }

  if (normalizedInput.includes("plan") || normalizedInput.includes("strategy")) {
    return `${agent.name}: Here's a quick framework—orient on the desired outcome, segment the audience, then orchestrate a sequence of voice touchpoints where each agent owns a slice of the journey.`;
  }

  if (normalizedInput.includes("voice") || normalizedInput.includes("tone")) {
    return `${agent.name}: Let's match tone and pacing to the listener's intent. I'll keep responses concise, warm, and directive, then hand-off to teammates where depth is required.`;
  }

  const personaLine = `${agent.name} · ${agent.role}`;
  return `${personaLine}: ${synthesizeResponse(agent, input)}`;
}

function synthesizeResponse(agent: AgentProfile, input: string): string {
  const templates = [
    `I'm mapping your ask against our ${agent.expertise.toLowerCase()}. Here's what stands out: ${input}`,
    `To keep the interaction fluid, I'll acknowledge intent, surface one actionable insight, and invite next steps.`,
    `I'll route this to another agent if we need deeper execution support. For now, here's how I recommend moving forward.`,
    `Let me mirror back what I heard: "${input}". Building on that, here's a refined direction.`,
    `I'm layering in our orchestration best practices so the conversation stays aligned with your target outcome.`
  ];

  const index = Math.abs(hashString(input)) % templates.length;
  return templates[index];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

export default AgentStudio;
