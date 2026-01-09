import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { Trip, ChatMessage } from '../types';

// Helper robusto para acessar variáveis de ambiente
const getEnv = (key: string) => {
  // 1. Tenta import.meta.env (Padrão Vite/Moderno)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) { /* ignore */ }

  // 2. Tenta process.env (Node/Webpack/Old)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) { /* ignore */ }

  return '';
};

const getClient = () => {
  const apiKey = getEnv("API_KEY");
  if (!apiKey) {
    console.warn("API_KEY não definida. As chamadas à IA falharão.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

// --- TOOL DEFINITIONS ---

const addActivityTool: FunctionDeclaration = {
  name: "add_activity",
  description: "Adiciona uma nova atividade ao roteiro. O custo DEVE ser sempre em BRL (Reais). Se for local físico, lat/lng são obrigatórios.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dayId: { type: Type.STRING, description: "O ID do dia onde adicionar (ex: day-123456789)." },
      title: { type: Type.STRING, description: "Título da atividade." },
      time: { type: Type.STRING, description: "Horário (HH:MM)." },
      type: { type: Type.STRING, description: "Tipo: SIGHTSEEING, FOOD, TRANSPORT, LODGING, OTHER" },
      location: { type: Type.STRING, description: "Nome do local ou endereço." },
      lat: { type: Type.NUMBER, description: "Latitude da localização." },
      lng: { type: Type.NUMBER, description: "Longitude da localização." },
      notes: { type: Type.STRING, description: "Notas ou observações." },
      cost: { type: Type.NUMBER, description: "Custo estimado da atividade em REAIS (BRL)." }
    },
    required: ["dayId", "title", "time", "type"]
  }
};

const updateActivityTool: FunctionDeclaration = {
  name: "update_activity",
  description: "Atualiza detalhes de uma atividade existente.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dayId: { type: Type.STRING, description: "ID do dia da atividade." },
      activityId: { type: Type.STRING, description: "ID da atividade a ser atualizada." },
      cost: { type: Type.NUMBER, description: "Novo valor de custo em REAIS (BRL)." },
      notes: { type: Type.STRING, description: "Novas notas." },
      time: { type: Type.STRING, description: "Novo horário." },
      title: { type: Type.STRING, description: "Novo título." },
      location: { type: Type.STRING, description: "Novo local." },
      lat: { type: Type.NUMBER, description: "Nova latitude." },
      lng: { type: Type.NUMBER, description: "Nova longitude." }
    },
    required: ["dayId", "activityId"]
  }
};

const removeActivityTool: FunctionDeclaration = {
  name: "remove_activity",
  description: "Remove uma atividade do roteiro.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dayId: { type: Type.STRING, description: "ID do dia." },
      activityId: { type: Type.STRING, description: "ID da atividade a remover." }
    },
    required: ["dayId", "activityId"]
  }
};

const getTripStateTool: FunctionDeclaration = {
  name: "get_trip_details",
  description: "Retorna o objeto JSON atual completo da viagem.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  }
};

const getExchangeRateTool: FunctionDeclaration = {
  name: "get_exchange_rate",
  description: "Obtém a taxa de câmbio atual entre duas moedas.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      baseCurrency: { type: Type.STRING, description: "Código da moeda de origem (ex: USD, EUR, JPY)." },
      targetCurrency: { type: Type.STRING, description: "Código da moeda de destino (ex: BRL)." }
    },
    required: ["baseCurrency", "targetCurrency"]
  }
};

export const createTripChat = (trip: Trip, history: ChatMessage[]) => {
  const ai = getClient();
  
  const apiHistory = history
    .filter(msg => msg.text && msg.text.trim() !== '')
    .map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

  const systemInstruction = `
    Você é um assistente de viagens inteligente do App "ViajaAI".
    
    CONTEXTO DA VIAGEM:
    Destino: ${trip.destination}
    Título: ${trip.title}
    
    REGRAS FINANCEIRAS E DE CÂMBIO (CRÍTICO):
    1. O aplicativo exibe valores em REAIS (BRL).
    2. Identifique a moeda local do destino (ex: EUA = USD, Europa = EUR, UK = GBP).
    3. Se o destino não for o Brasil, use a ferramenta 'get_exchange_rate' para obter a cotação atual para BRL.
    4. Ao pesquisar preços (via 'googleSearch'), eles virão na moeda local. CONVERTA-OS para BRL usando a taxa obtida antes de chamar 'add_activity' ou 'update_activity'.
    5. Nas 'notes' da atividade, adicione o preço original entre parênteses. Ex: "Jantar (aprox. $50 USD)".
    
    IMPORTANTE SOBRE MAPAS:
    Ao adicionar uma atividade ('add_activity') que tenha um endereço físico, VOCÊ DEVE fornecer 'lat' e 'lng' (Latitude e Longitude) aproximados para que apareça no mapa.
    
    PROCEDIMENTO PADRÃO:
    1. Usuário pede sugestão.
    2. Identifique moeda e pegue cotação ('get_exchange_rate').
    3. Pesquise locais e preços reais ('googleSearch').
    4. Adicione ao roteiro convertendo o valor ('add_activity').
  `;

  // Define tools
  const tools: Tool[] = [
    {
      functionDeclarations: [addActivityTool, updateActivityTool, removeActivityTool, getTripStateTool, getExchangeRateTool],
    },
    {
      googleSearch: {} 
    }
  ];

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: systemInstruction,
      tools: tools,
    },
    history: apiHistory
  });
};