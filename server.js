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
// FUNCIÓN LOCAL: PRODUCTO MÁS VENDIDO
// ENTREGABLE 3
// ========================================

const getBestSellingProduct = (startDate, endDate) => {

  console.log("========================================");
  console.log("Ejecutando función getBestSellingProduct");
  console.log("Fecha inicial:", startDate);
  console.log("Fecha final:", endDate);
  console.log("========================================");

  // MOCK
  // En una versión real, aquí se consultaría
  // la base de datos del negocio.

  return {
    startDate: startDate,
    endDate: endDate,
    product: "Leche PIL",
    quantity: 150
  };
};


// ========================================
// FUNCIÓN LOCAL: PRODUCTO MENOS VENDIDO
// ENTREGABLE 3
// ========================================

const getWorstSellingProduct = (startDate, endDate) => {

  console.log("========================================");
  console.log("Ejecutando función getWorstSellingProduct");
  console.log("Fecha inicial:", startDate);
  console.log("Fecha final:", endDate);
  console.log("========================================");

  // MOCK
  // En una versión real, aquí se consultaría
  // la base de datos del negocio.

  return {
    startDate: startDate,
    endDate: endDate,
    product: "Yogur Natural",
    quantity: 20
  };
};


// ========================================
// FUNCIÓN LOCAL: CLIENTE CON MÁS COMPRAS
// ENTREGABLE 3
// ========================================

const getTopCustomer = (startDate, endDate) => {

  console.log("========================================");
  console.log("Ejecutando función getTopCustomer");
  console.log("Fecha inicial:", startDate);
  console.log("Fecha final:", endDate);
  console.log("========================================");

  // MOCK
  // En una versión real, aquí se consultaría
  // la base de datos del negocio.

  return {
    startDate: startDate,
    endDate: endDate,
    customer: "Juan Pérez",
    purchases: 25
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
// FUNCTION CALLING
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
    // 2. DEFINICIÓN DE LAS FUNCIONES
    // ========================================

    const tools = [

      // ========================================
      // FUNCIÓN 1 - GET PROFITS
      // ========================================

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

      },


      // ========================================
      // FUNCIÓN 2 - PRODUCTO MÁS VENDIDO
      // ========================================

      {

        type: "function",

        name: "getBestSellingProduct",

        description:
          "Obtiene el producto más vendido de un negocio para un rango de fechas. " +
          "Debe utilizarse cuando el usuario pregunte cuál fue su producto más vendido, " +
          "qué producto vendió más o cuál fue el producto con mayor cantidad de ventas.",

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

      },


      // ========================================
      // FUNCIÓN 3 - PRODUCTO MENOS VENDIDO
      // ========================================

      {

        type: "function",

        name: "getWorstSellingProduct",

        description:
          "Obtiene el producto menos vendido de un negocio para un rango de fechas. " +
          "Debe utilizarse cuando el usuario pregunte cuál fue su producto menos vendido, " +
          "qué producto vendió menos o cuál tuvo la menor cantidad de ventas.",

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

      },


      // ========================================
      // FUNCIÓN 4 - CLIENTE CON MÁS COMPRAS
      // ========================================

      {

        type: "function",

        name: "getTopCustomer",

        description:
          "Obtiene el cliente que realizó más compras en un negocio durante un rango de fechas. " +
          "Debe utilizarse cuando el usuario pregunte qué cliente compra más, " +
          "quién es el cliente que más compras realiza o cuál es su cliente principal.",

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
      // 6. OBTENER ARGUMENTOS
      // ========================================

      const args = JSON.parse(item.arguments);


      console.log("Argumentos recibidos:");

      console.log(args);


      // ========================================
      // 7. EJECUTAR GET PROFITS
      // ========================================

      if (item.name === "getProfits") {

        functionCalled = true;


        const result = getProfits(

          args.startDate,

          args.endDate

        );


        console.log("Resultado de getProfits:");

        console.log(result);


        input.push({

          type: "function_call_output",

          call_id: item.call_id,

          output: JSON.stringify(result)

        });

      }


      // ========================================
      // 8. EJECUTAR PRODUCTO MÁS VENDIDO
      // ========================================

      else if (item.name === "getBestSellingProduct") {

        functionCalled = true;


        const result = getBestSellingProduct(

          args.startDate,

          args.endDate

        );


        console.log(
          "Resultado de getBestSellingProduct:"
        );

        console.log(result);


        input.push({

          type: "function_call_output",

          call_id: item.call_id,

          output: JSON.stringify(result)

        });

      }


      // ========================================
      // 9. EJECUTAR PRODUCTO MENOS VENDIDO
      // ========================================

      else if (item.name === "getWorstSellingProduct") {

        functionCalled = true;


        const result = getWorstSellingProduct(

          args.startDate,

          args.endDate

        );


        console.log(
          "Resultado de getWorstSellingProduct:"
        );

        console.log(result);


        input.push({

          type: "function_call_output",

          call_id: item.call_id,

          output: JSON.stringify(result)

        });

      }


      // ========================================
      // 10. EJECUTAR CLIENTE CON MÁS COMPRAS
      // ========================================

      else if (item.name === "getTopCustomer") {

        functionCalled = true;


        const result = getTopCustomer(

          args.startDate,

          args.endDate

        );


        console.log(
          "Resultado de getTopCustomer:"
        );

        console.log(result);


        input.push({

          type: "function_call_output",

          call_id: item.call_id,

          output: JSON.stringify(result)

        });

      }

    }


    // ========================================
    // 11. SI NO HUBO FUNCTION CALL
    // ========================================

    if (!functionCalled) {

      return res.json({

        response: response.output_text

      });

    }


    // ========================================
    // 12. SEGUNDA LLAMADA A OPENAI
    // ========================================

    response = await client.responses.create({

      model: "gpt-4.1-mini",

      input: input,

      tools: tools

    });


    // ========================================
    // 13. RESPUESTA FINAL
    // ========================================

    res.json({

      response: response.output_text

    });


  } catch (error) {


    // ========================================
    // MANEJO DE ERRORES
    // ========================================

    console.error(
      "========================================"
    );

    console.error(
      "ERROR EN /function"
    );

    console.error(error);

    console.error(
      "========================================"
    );


    res.status(500).json({

      error: "Error al comunicarse con OpenAI"

    });

  }

});


// ========================================
// ENCENDER SERVIDOR
// ========================================

app.listen(3000, () => {

  console.log(
    "========================================"
  );

  console.log(
    "Servidor funcionando en puerto 3000"
  );

  console.log(
    "Entregable 1: POST /chat"
  );

  console.log(
    "Function Calling: POST /function"
  );

  console.log(
    "Funciones disponibles:"
  );

  console.log(
    "- getProfits"
  );

  console.log(
    "- getBestSellingProduct"
  );

  console.log(
    "- getWorstSellingProduct"
  );

  console.log(
    "- getTopCustomer"
  );

  console.log(
    "========================================"
  );

});