import jwt from 'jwt-simple';
import moment from 'moment';
import dotenv from 'dotenv';

dotenv.config();

//Clave secreta 

const secret = process.env.SECRET_KEY;

// Generar token

const createToken = (user) => {
    const payload = {
        userId: user._id,
        role: user.role,
        //Fecha de emisión
        iat: moment().unix(),
        exp: moment().add(30, 'days').unix()
    };

    //Devolver el token codificado

    return jwt.encode(payload, secret);
};

export {
    secret,
    createToken
}

