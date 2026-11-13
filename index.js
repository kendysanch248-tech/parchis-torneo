const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const salas = {};

io.on("connection", (socket) => {
  console.log("✅ Jugador conectado:", socket.id);

  socket.on("crear_sala", (callback) => {
    const codigoSala = Math.random().toString(36).substring(2,8).toUpperCase();
    salas[codigoSala] = {jugadores: [], maxJugadores:4, estado:"esperando"};
    callback(codigoSala);
  });

  socket.on("unirse_sala", (codigoSala, callback) => {
    if(!salas[codigoSala]){callback({error:"La sala no existe"});return;}
    if(salas[codigoSala].jugadores.length >= salas[codigoSala].maxJugadores){callback({error:"La sala está llena"});return;}
    salas[codigoSala].jugadores.push({id:socket.id});
    socket.join(codigoSala);
    io.to(codigoSala).emit("actualizar_sala", salas[codigoSala]);
    if(salas[codigoSala].jugadores.length === 4){salas[codigoSala].estado="iniciada";io.to(codigoSala).emit("iniciar_partida", salas[codigoSala]);}
    callback({exito:true, sala:salas[codigoSala]});
  });

  socket.on("disconnect", () => {
    for(const codigo in salas){
      salas[codigo].jugadores = salas[codigo].jugadores.filter(j => j.id !== socket.id);
      io.to(codigo).emit("actualizar_sala", salas[codigo]);
      if(salas[codigo].jugadores.length ===0) delete salas[codigo];
    }
    console.log("❌ Jugador desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);});
