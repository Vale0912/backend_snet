import {connect} from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connection = async() => {
    try {
        await connect(process.env.MONGODB_URI);
        console.log("Conectado correctamente a db_social_network");
    } catch (error) {
        console.log("Error al conectar la DB", error);
        throw new Error("¡No se ha podido conectar a la bd!");
    }
}

export default connection;