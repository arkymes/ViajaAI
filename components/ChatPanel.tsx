import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Loader2, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Trip, ChatMessage, ActivityType, Activity } from '../types';
import { createTripChat } from '../services/geminiService';

interface ChatPanelProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  // Callbacks to modify app state
  onAddActivity: (dayId: string, activity: Partial<Activity>) => void;
  onUpdateActivity: (dayId: string, activityId: string, updates: Partial<Activity>) => void;
  onRemoveActivity: (dayId: string, activityId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  trip, 
  isOpen, 
  onClose,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Olá! Sou seu assistente para **${trip.destination}**. Posso pesquisar preços, sugerir atrações e **alterar seu roteiro** automaticamente. O que deseja?`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingTool, setProcessingTool] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);

  // Keep trip ref updated so tools access latest state without closure staleness
  const tripRef = useRef(trip);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  useEffect(() => {
    // Reset chat on new trip
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: `Olá! Sou seu assistente para **${trip.destination}**. Posso pesquisar preços, sugerir atrações e **alterar seu roteiro** automaticamente. O que deseja?`,
      timestamp: Date.now()
    }]);
    chatInstance.current = null;
  }, [trip.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- TOOL EXECUTION LOGIC ---
  const executeTools = async (functionCalls: any[]) => {
    setProcessingTool(true);
    const responses = [];

    for (const call of functionCalls) {
      const { name, args } = call;
      console.log(`[ViajaAI] Executing Tool: ${name}`, args);
      
      let result = { result: "Done" };

      try {
        switch (name) {
          case 'get_exchange_rate':
            try {
              // API pública gratuita que não exige chave
              const base = args.baseCurrency || 'USD';
              const target = args.targetCurrency || 'BRL';
              const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
              const data = await response.json();
              
              if (data && data.rates && data.rates[target]) {
                const rate = data.rates[target];
                result = { result: `Taxa de câmbio: 1 ${base} = ${rate} ${target}. Data: ${data.time_last_update_utc}` };
              } else {
                result = { result: "Erro ao obter taxa de câmbio." };
              }
            } catch (err) {
              console.error("Erro na API de Câmbio", err);
              result = { result: "Falha na conexão com API de câmbio." };
            }
            break;

          case 'add_activity':
            onAddActivity(args.dayId, {
              title: args.title,
              time: args.time,
              type: args.type as ActivityType,
              location: args.location,
              notes: args.notes,
              cost: args.cost,
              lat: args.lat,
              lng: args.lng
            });
            result = { result: `Atividade '${args.title}' adicionada com sucesso.` };
            break;

          case 'update_activity':
            onUpdateActivity(args.dayId, args.activityId, {
              ...(args.cost !== undefined && { cost: args.cost }),
              ...(args.notes && { notes: args.notes }),
              ...(args.time && { time: args.time }),
              ...(args.title && { title: args.title }),
              ...(args.location && { location: args.location }),
              ...(args.lat !== undefined && { lat: args.lat }),
              ...(args.lng !== undefined && { lng: args.lng }),
            });
            result = { result: `Atividade atualizada.` };
            break;

          case 'remove_activity':
            onRemoveActivity(args.dayId, args.activityId);
            result = { result: `Atividade removida.` };
            break;

          case 'get_trip_details':
            result = { result: JSON.stringify(tripRef.current) };
            break;

          default:
            result = { result: "Ferramenta desconhecida." };
        }
      } catch (e: any) {
        console.error("Tool execution error", e);
        result = { result: `Erro ao executar: ${e.message}` };
      }

      responses.push({
        id: call.id, 
        name: name,
        response: result
      });
    }

    setProcessingTool(false);
    return responses;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatInstance.current) {
        chatInstance.current = createTripChat(tripRef.current, messages); 
      }
      
      // 1. Send Message
      let result = await chatInstance.current.sendMessage({ message: userMsg.text });
      
      // 2. Check for Tool Calls
      let functionCalls = result?.functionCalls;
      
      while (functionCalls && functionCalls.length > 0) {
        const toolResponses = await executeTools(functionCalls);
        
        // Send Tool Responses
        result = await chatInstance.current.sendMessage({
          message: toolResponses.map(tr => ({
            functionResponse: tr
          }))
        });
        
        functionCalls = result?.functionCalls;
      }

      // 3. Final Text Response
      // Use optional chaining purely for safety, though SDK guarantees the object exists
      const responseText = result?.text;
      
      const groundingChunks = result?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let groundingText = "";
      if (groundingChunks) {
        const sources = groundingChunks
          .map((chunk: any) => chunk.web?.uri ? `[${chunk.web.title}](${chunk.web.uri})` : null)
          .filter(Boolean)
          .join(', ');
        if (sources) {
          groundingText = `\n\n*Fontes: ${sources}*`;
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: (responseText || "") + groundingText,
        timestamp: Date.now()
      }]);

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Desculpe, tive um problema ao processar seu pedido. Verifique sua chave de API.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      setProcessingTool(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-brand-600 to-brand-500 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Gemini Assistente</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
              }`}
            >
              <ReactMarkdown 
                className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-white"
                components={{
                  a: ({node, ...props}) => <a {...props} className="text-brand-300 underline font-medium" target="_blank" rel="noopener noreferrer" />
                }}
              >
                {msg.text || "..."}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {(isLoading || processingTool) && (
           <div className="flex justify-start">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center gap-2">
               {processingTool ? (
                  <>
                    <Wrench className="w-4 h-4 animate-bounce text-purple-500" />
                    <span className="text-xs text-purple-600 font-medium">Atualizando roteiro...</span>
                  </>
               ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                    <span className="text-xs text-slate-500">Gemini está pensando...</span>
                  </>
               )}
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-center gap-2 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ex: 'Adicione um jantar romântico' ou 'Calcule o total'"
            className="w-full resize-none border border-slate-300 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm max-h-32 bg-slate-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-400">Gemini com Google Search pode pesquisar preços reais.</p>
        </div>
      </div>
    </div>
  );
};