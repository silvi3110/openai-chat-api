require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();

app.use(express.json());


// ========================================
// FUNCIÓN LOCAL: GET PROFITS
// ENTREGABLE 2 - FUNCTION CALLING
// ========================================

const getProfits = (startDate, endDate) => {

  console.log("========================================");
  console.log("Ejecutando función getProfits");
  console.log("Fecha inicial:", startDate);
  console.log("Fecha final:", endDate);
  console.log("========================================");

  // MOCK
  // En una versión real, aquí se consultaría
  // la base de datos del negocio.

  return {
    startDate: startDate,
    endDate: endDate,
    profits: 1000
  };
};


// ========================================
// ENDPOINT POST /chat
// ENTREGABLE 1
// ========================================

app.post("/chat", async (req, res) => {

  const message = req.body.message;


  // Validación si no existe mensaje
  if (!message) {
    return res.status(400).json({
      error: "El campo message es obligatorio"
    });
  }


  // Validación si no es texto
  if (typeof message !== "string") {
    return res.status(400).json({
      error: "El campo message debe ser texto"
    });
  }


  try {

    const response = await client.responses.create({

      model: "gpt-4.1-mini",

      input: message

    });


    res.json({

      response: response.output_text

    });


  } catch (error) {

    console.error("Error:", error);

    res.status(500).json({

      error: "Error al comunicarse con OpenAI"

    });

  }

});


// ========================================
// ENDPOINT POST /function
// ENTREGABLE 2 - FUNCTION CALLING
// ========================================

app.post("/function", async (req, res) => {

  const message = req.body.message;


  // ========================================
  // VALIDACIONES
  // ========================================

  if (!message) {
    return res.status(400).json({
      error: "El campo message es obligatorio"
    });
  }


  if (typeof message !== "string") {
    return res.status(400).json({
      error: "El campo message debe ser texto"
    });
  }


  try {


    // ========================================
    // 1. MENSAJE DEL USUARIO
    // ========================================

    let input = [
      {
        role: "user",
        content: message
      }
    ];


    // ========================================
    // 2. DEFINICIÓN DE LA FUNCIÓN
    // ========================================

    const tools = [

      {
        type: "function",

        name: "getProfits",

        description:
          "Obtiene la ganancia de las ventas de un negocio para un rango de fechas. " +
          "Debe utilizarse cuando el usuario pregunte cuánto ganó, cuáles fueron sus ganancias " +
          "o cuánto obtuvo de ganancia en un periodo determinado.",

        strict: true,

        parameters: {

          type: "object",

          properties: {

            startDate: {
              type: "string",
              description:
                "Fecha inicial del periodo solicitado en formato YYYY-MM-DD."
            },

            endDate: {
              type: "string",
              description:
                "Fecha final del periodo solicitado en formato YYYY-MM-DD."
            }

          },

          required: [
            "startDate",
            "endDate"
          ],

          additionalProperties: false

        }

      }

    ];


    // ========================================
    // 3. PRIMERA LLAMADA A OPENAI
    // ========================================

    let response = await client.responses.create({

      model: "gpt-4.1-mini",

      input: input,

      tools: tools

    });


    // ========================================
    // 4. GUARDAR LA RESPUESTA DEL MODELO
    // ========================================

    input.push(...response.output);


    // ========================================
    // 5. BUSCAR FUNCTION CALL
    // ========================================

    let functionCalled = false;


    for (const item of response.output) {


      // Verificamos si OpenAI solicitó
      // ejecutar una función.

      if (item.type !== "function_call") {
        continue;
      }


      console.log(
        "OpenAI solicitó ejecutar:",
        item.name
      );


      // ========================================
      // 6. VERIFICAR LA FUNCIÓN
      // ========================================

      if (item.name === "getProfits") {

        functionCalled = true;


        // ========================================
        // 7. OBTENER ARGUMENTOS
        // ========================================

        const args = JSON.parse(item.arguments);


        console.log("Argumentos recibidos:");

        console.log(args);


        // ========================================
        // 8. EJECUTAR FUNCIÓN LOCAL
        // ========================================

        const result = getProfits(
          args.startDate,
          args.endDate
        );


        console.log("Resultado de getProfits:");

        console.log(result);


        // ========================================
        // 9. DEVOLVER RESULTADO A OPENAI
        // ========================================

        input.push({

          type: "function_call_output",

          call_id: item.call_id,

          output: JSON.stringify(result)

        });

      }

    }


    // ========================================
    // 10. SI NO HUBO FUNCTION CALL
    // ========================================

    if (!functionCalled) {

      return res.json({

        response: response.output_text

      });

    }


    // ========================================
    // 11. SEGUNDA LLAMADA A OPENAI
    // ========================================
    // OpenAI recibe ahora el resultado
    // de nuestra función local.

    response = await client.responses.create({

      model: "gpt-4.1-mini",

      input: input,

      tools: tools

    });


    // ========================================
    // 12. RESPUESTA FINAL
    // ========================================

    res.json({

      response: response.output_text

    });


  } catch (error) {


    // ========================================
    // MANEJO DE ERRORES
    // ========================================

    console.error("========================================");

    console.error("ERROR EN /function");

    console.error(error);

    console.error("========================================");


    res.status(500).json({

      error: "Error al comunicarse con OpenAI"

    });

  }

});


// ========================================
// ENCENDER SERVIDOR
// ========================================

app.listen(3000, () => {

  console.log("========================================");

  console.log("Servidor funcionando en puerto 3000");

  console.log("Entregable 1: POST /chat");

  console.log("Entregable 2: POST /function");

  console.log("========================================");

});