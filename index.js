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

// Almacén de salas
const salas = {};

io.on("connection", (socket) => {
  console.log("✅ Jugador conectado:", socket.id);

  // Crear sala
  socket.on("crear_sala", (callback) => {
    const codigoSala = Math.random().toString(36).substring(2, 8).toUpperCase();
    salas[codigoSala] = {
      jugadores: [],
      maxJugadores: 4,
      estado: "esperando",
      temporizador: setTimeout(() => {
        cancelarSala(codigoSala);
      }, 30 * 60 * 1000) // 30 minutos
    };
    callback(codigoSala);
  });

  // Unirse a sala
  socket.on("unirse_sala", (codigoSala, callback) => {
    if (!salas[codigoSala]) {
      callback({ error: "La sala no existe" });
      return;
    }
    if (salas[codigoSala].jugadores.length >= salas[codigoSala].maxJugadores) {
      callback({ error: "La sala está llena" });
      return;
    }
    salas[codigoSala].jugadores.push({ id: socket.id });
    socket.join(codigoSala);
    io.to(codigoSala).emit("actualizar_sala", salas[codigoSala]);

    // Sala llena → iniciar partida y cancelar temporizador
    if (salas[codigoSala].jugadores.length === 4) {
      clearTimeout(salas[codigoSala].temporizador);
      salas[codigoSala].estado = "iniciada";
      io.to(codigoSala).emit("iniciar_partida", salas[codigoSala]);
    }
    callback({ exito: true, sala: salas[codigoSala] });
  });

  // Registrar ganadores (1.º y 2.º lugar)
  socket.on("registrar_ganadores", (codigoSala, primerGanador, segundoGanador) => {
    if (!salas[codigoSala]) return;
    salas[codigoSala].primerGanador = primerGanador;
    salas[codigoSala].segundoGanador = segundoGanador;
    salas[codigoSala].estado = "finalizada";
    io.to(codigoSala).emit("sala_finalizada", salas[codigoSala]);
    console.log(`🏆 Sala ${codigoSala} finalizada. 1.º:${primerGanador}, 2.º:${segundoGanador}`);
  });

  // Desconexión jugador
  socket.on("disconnect", () => {
    for (const codigo in salas) {
      salas[codigo].jugadores = salas[codigo].jugadores.filter(j => j.id !== socket.id);
      io.to(codigo).emit("actualizar_sala", salas[codigo]);
      if (salas[codigo].jugadores.length === 0) {
        clearTimeout(salas[codigo].temporizador);
        delete salas[codigo];
      }
    }
    console.log("❌ Jugador desconectado:", socket.id);
  });
});

// Función cancelar sala si no se llenó en 30 min
function cancelarSala(codigoSala) {
  if (!salas[codigoSala]) return;
  salas[codigoSala].estado = "cancelada";
  io.to(codigoSala).emit("sala_cancelada", { codigoSala, mensaje: "No se completaron 4 jugadores, devolver diamantes" });
  console.log(`⏱️ Sala ${codigoSala} cancelada por tiempo, devolver 20 💎 a cada jugador`);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});