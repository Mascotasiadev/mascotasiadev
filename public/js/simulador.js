/**
 * Componente Inyectable: Simulador de Chat IA (Zero-Latency)
 * Se dibuja automáticamente sobre cualquier pantalla sin ensuciar el HTML base.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inyectar la interfaz gráfica en el body
    const simuladorHTML = `
        <!-- Botón flotante -->
        <button onclick="toggleChatSimulador()" class="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 cursor-pointer border-none">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
        </button>

        <!-- Ventana Flotante -->
        <div id="chat-simulator" class="fixed bottom-24 right-6 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 flex-col hidden z-50 flex text-sm font-sans" style="height: 500px;">
            <div class="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <h3 class="font-bold m-0 text-sm">Simulador IA (Sin Meta)</h3>
                </div>
                <button onclick="toggleChatSimulador()" class="text-white hover:text-gray-200 font-bold bg-transparent border-none cursor-pointer">✖</button>
            </div>
            
            <div id="chat-messages" class="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
                <div class="bg-gray-200 text-gray-800 p-3 rounded-lg rounded-tl-none self-start max-w-[85%]">
                    ¡Hola! Soy el motor aislado. Escribe un mensaje para probar mi velocidad y reglas de negocio.
                </div>
            </div>
            
            <div class="p-3 border-t border-gray-200 bg-white rounded-b-lg flex gap-2">
                <input type="text" id="chat-input" placeholder="Escribe como cliente..." class="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600" onkeypress="if(event.key === 'Enter') enviarMensajeSimulado()">
                <button onclick="enviarMensajeSimulado()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium border-none cursor-pointer">Enviar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', simuladorHTML);
});

// 2. Función para mostrar/ocultar
window.toggleChatSimulador = function() {
    document.getElementById('chat-simulator').classList.toggle('hidden');
};

// 3. Función para procesar los mensajes contra tu backend
window.enviarMensajeSimulado = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chatMessages = document.getElementById('chat-messages');
    
    // Mensaje del usuario
    chatMessages.innerHTML += `
        <div class="bg-blue-100 text-blue-900 p-3 rounded-lg rounded-tr-none self-end max-w-[85%] break-words shadow-sm mt-2 ml-auto">
            ${text}
        </div>
    `;
    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const urlParams = new URLSearchParams(window.location.search);
    const tenantId = urlParams.get('tenantId');

    try {
        const loadingId = 'loading-' + Date.now();
        chatMessages.innerHTML += `<div id="${loadingId}" class="text-gray-400 text-xs self-start italic px-2 mt-1">La IA está escribiendo...</div>`;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const response = await fetch('/api/whatsapp/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: tenantId,
                fromPhone: '593999999999',
                text: text
            })
        });

        const data = await response.json();
        document.getElementById(loadingId).remove();

        if(data.success) {
            chatMessages.innerHTML += `
                <div class="bg-gray-200 text-gray-800 p-3 rounded-lg rounded-tl-none self-start max-w-[85%] whitespace-pre-wrap shadow-sm mt-2">
                    ${data.reply}
                </div>
                <div class="text-[10px] text-gray-400 self-start ml-1 font-mono mt-1">⚡ ${data.latencyMs}</div>
            `;
        } else {
            throw new Error(data.message || "Error en servidor");
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('loading-' + Date.now())?.remove();
        chatMessages.innerHTML += `<div class="text-red-500 text-xs self-start px-2 mt-1">❌ Error de conexión.</div>`;
    }
};