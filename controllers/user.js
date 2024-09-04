import User from "../models/users.js";
import bcrypt from "bcrypt";
import { createToken } from "../services/jwt.js";
import fs from "fs";
import path from "path";
import {followThisUser} from "../services/followServices.js";

// Método de prueba

export const testUser = (req, res) => {
  return res.status(200).send({
    message: "Mensaje enviado desde el controlador user.js",
    user: req.user,
  });
};

// Método registro de usuarios

export const register = async (req, res) => {
  try {
    // Obtener los datos de la petición

    let params = req.body;

    // Validaciones de los datos obtenidos

    if (
      !params.name ||
      !params.last_name ||
      !params.email ||
      !params.password ||
      !params.nick
    ) {
      return res.status(400).send({
        status: "error",
        message: "Faltan datos por enviar",
      });
    }

    // Crear el objeto que ya validado

    let user_to_save = new User(params);
    user_to_save.email = params.email.toLowerCase();

    // Busca si ya existe un usuario con el mismo email o nick

    const existingUser = await User.findOne({
      $or: [
        { email: user_to_save.email.toLowerCase() },
        { nick: user_to_save.nick.toLowerCase() },
      ],
    });

    //Si encuentra un usuario, devuelve un mensaje indicando que ya existe

    if (existingUser) {
      return res.status(409).send({
        status: "error",
        message: "El usuario ya existe",
      });
    }

    // Cifra la contraseña antes de guardarla en la bd

    const salt = await bcrypt.genSalt(10); //Genera una sal para cifrar la contraseña
    const hashedPassword = await bcrypt.hash(user_to_save.password, salt); //cifra la contraseña
    user_to_save.password = hashedPassword; // Asigna la contraseña cifrada al usuario

    //Guardar el usuario en la bd

    await user_to_save.save();

    // Devolver el usuario registrado

    return res.status(200).json({
      status: "success",
      message: "Registro exitoso",
      params,
      user_to_save,
    });
  } catch (error) {
    //Manejo de errores
    console.log("Error en el registro de usuario", error);
    // Devuelve manejo de error
    return res.status(500).send({
      status: "error",
      message: "Error en el registro de usuario",
    });
  }
};

// Método de autenticación (login) usando jwt

export const login = async (req, res) => {
  try {
    //Obtener los datos de la petición

    let params = req.body;

    //Validamos los datos de email y password

    if (!params.email || !params.password) {
      return res.status(400).send({
        status: "error",
        message: "Faltan datos por enviar",
      });
    }

    //Buscar en la bd si existe el email recibido

    const user = await User.findOne({ email: params.email.toLowerCase() });

    //Si no existe el usuario

    if (!user) {
      return res.status(404).send({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    //Comprobar password

    const validPassword = await bcrypt.compare(params.password, user.password);

    //Si la contraseña es incorrecta

    if (!validPassword) {
      return res.status(401).send({
        status: "error",
        message: "Contraseña incorrecta",
      });
    }

    //Generar token de autenticación

    const token = createToken(user);

    //Devolver el token y mostrar los datos del usuario

    return res.status(200).json({
      status: "success",
      message: "Login exitoso",
      token,
      user: {
        id: user._id,
        name: user.name,
        last_name: user.last_name,
        email: user.email,
        nick: user.nick,
        image: user.image,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    //Manejo de errores
    console.log("Error en la autenticación del usuario", error);
    // Devuelve manejo de error
    return res.status(500).send({
      status: "error",
      message: "Error en la autenticación del usuario",
    });
  }
};

//Método para mostrar el perfil del usuario

export const profile = async (req, res) => {
  try {
    //Obtener el id del usuario desde la petición

    const userId = req.params.id;

     // Verificar si el ID del usuario autenticado está disponible
     if(!req.user || !req.user.userId){
      return res.status(401).send({
        status: "success",
        message: "Usuario no autenticado"
      });
    }

    //Buscar el usuario en la BD y excluimos los datos que no queremos mostrar

    const userProfile = await User.findById(userId).select(
      "-password -role -email -__v"
    );

    //Verificar si el usuario no existe
    if (!userProfile) {
      return res.status(404).send({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

     // Información del seguimiento
     const followInfo = await followThisUser(req.user.userId, userId);

    return res.status(200).json({
      status: "success",
      user: userProfile,
      followInfo
    });
  } catch (error) {
    console.log("Error al obtener el perfil del usuario", error);
    return res.status(500).send({
      status: "error",
      message: "Error al obtener el perfil del usuario",
    });
  }
};

//Método listar usuarios con paginación de mongoose

export const listUsers = async (req, res) => {
  try {
    //Gestionar paginas
    //Controlar la pagina actual operacion ternaria (condicion ? si_verdadero : si_falso)

    let page = req.params.page ? parseInt(req.params.page, 10) : 1;

    //Configurar los items por pagina

    let itemsPerPage = req.query.limit ? parseInt(req.query.limit, 10) : 3;

    //Realizar consulta paginada
    const options = {
      page: page,
      limit: itemsPerPage,
      select: "-password -email -role -__v",
    };
    const users = await User.paginate({}, options);

    //Si no hay usuarios disponibles
    if (!users || users.docs.length === 0) {
      return res.status(404).send({
        status: "error",
        message: "No existen usuarios disponibles",
      });
    }

    //Devolver los usuarios paginados
    return res.status(200).json({
      status: "success",
      users: users.docs,
      totalDocs: users.totalDocs,
      totalPages: users.totalPages,
      CurrentPage: users.page,
    });
  } catch (error) {
    console.log("Error al listar usuarios", error);
    return res.status(500).send({
      status: "error",
      message: "Error al listar usuarios",
    });
  }
};

//Método actualización de datos de usuario

export const updateUser = async (req, res) => {
  try {
    //Obtener informacion del usuario a actualizar
    let userIdentity = req.user;
    let userToUpdate = req.body;

    //Eliminar los campos que sobran
    delete userToUpdate.iat;
    delete userToUpdate.exp;
    delete userToUpdate.role;

    //Comprobar que el usuario existe
    const users = await User.find({
      $or: [{ email: userToUpdate.email }, { nick: userToUpdate.nick }],
    }).exec();

    //Verificar el usuario esta duplicado y evitar conflictos
    const isDuplicateUser = users.some((user) => {
      return user && user._id.toString() !== userIdentity.userId;
    });

    if (isDuplicateUser) {
      return res.status(400).send({
        status: "error",
        message:
          "Error:  solo se pueden actualizar los datos del usuario logueado",
      });
    }

    //Cifrar contraseña si se proporciona una nueva
    if (userToUpdate.password) {
      try {
        let pwd = await bcrypt.hash(userToUpdate.password, 10);
        userToUpdate.password = pwd;
      } catch (hashError) {
        return res.status(500).send({
          status: "error",
          message: "Error al cifrar la contraseña",
        });
      }
    } else {
      delete userToUpdate.password;
    }

    //Buscar y actualizar
    let userUpdated = await User.findByIdAndUpdate(
      userIdentity.userId,
      userToUpdate,
      { new: true }
    );

    if (!userUpdated) {
      return res.status(400).send({
        status: "error",
        message: "Error al actualizar el usuario",
      });
    }

    //Devolver la respuesta exitosa
    return res.status(200).send({
      status: "success",
      message: "Usuario actualizado correctamente",
      user: userUpdated,
    });
  } catch (error) {
    console.log("Error al actualizar el usuario", error);
    return res.status(500).send({
      status: "error",
      message: "Error al actualizar el usuario",
    });
  }
};

//Método para subir avatar y actualizar el campo image del user

export const uploadAvatar = async (req, res) => {
  try {
    //Obtener el archivo de la imagen y comprobar si existe
    if (!req.file) {
      return res.status(404).send({
        status: "error",
        message: "La petición no incluye una imagen",
      });
    }

    //Obtener el nombre del archivo
    let image = req.file.originalname;

    //Obtener la extension del archivo

    const imageSplit = image.split(".");
    const extension = imageSplit[imageSplit.length - 1];

    //Validar la extensión

    if (!["png", "jpg", "jpeg", "gif"].includes(extension.toLowerCase())) {
      //Borrar el archivo subido
      const filePath = req.file.path;
      fs.unlinkSync(filePath);

      return res.status(404).send({
        status: "error",
        message: "Extensión del archivo invalido",
      });
    }

    // Comprobar tamaño del archivo (pj: máximo 1MB)
    const fileSize = req.file.size;
    const maxFileSize = 1 * 1024 * 1024; // 1 MB

    if (fileSize > maxFileSize) {
      const filePath = req.file.path;
      fs.unlinkSync(filePath);

      return res.status(400).send({
        status: "error",
        message: "El tamaño del archivo excede el límite (máx 1 MB)",
      });
    }

    // Guardar la imagen en la BD
    const userUpdated = await User.findOneAndUpdate(
      { _id: req.user.userId },
      { image: req.file.filename },
      { new: true }
    );

    // verificar si la actualización fue exitosa
    if (!userUpdated) {
      return res.status(500).send({
        status: "error",
        message: "Error en la subida de la imagen",
      });
    }

    // Devolver respuesta exitosa

    return res.status(200).send({
      status: "success",
      user: userUpdated,
      file: req.file,
    });
  } catch (error) {
    console.log("Error al subir el archivo", error);
    return res.status(500).send({
      status: "error",
      message: "Error al subir el archivo",
    });
  }
};

// Método para mostrar el AVATAR (imagen de perfil)
export const avatar = async (req, res) => {
  try {
    // Obtener el parámetro del archivo desde la url
    const file = req.params.file;

    // Configurando el path real de la imagen que queremos mostrar
    const filePath = "./uploads/avatars/" + file;

    // Comprobar que si existe el filePath
    fs.stat(filePath, (error, exists) => {
      if (!filePath) {
        return res.status(404).send({
          status: "error",
          message: "No existe la imagen",
        });
      }

      // Devolver el file
      return res.sendFile(path.resolve(filePath));
    });
  } catch (error) {
    console.log("Error al mostrar la imagen", error);
    return res.status(500).send({
      status: "error",
      message: "Error al mostrar la imagen",
    });
  }
};

// Método para mostrar contador de seguidores y publicaciones
export const counters = async (req, res) => {
  try {
    // Obtener el Id del usuario autenticado (token)
    let userId = req.user.userId;

    // Si llega el id a través de los parámetros en la URL tiene prioridad
    if(req.params.id){
      userId = req.params.id;
    }

    // Obtener el nombre y apellido del usuario
    const user = await User.findById(userId, { name: 1, last_name: 1});

    // Vericar el user
    if(!user){
      return res.status(404).send({
        status: "error",
        message: "Usuario no encontrado"
      });
    }

    // Contador de usuarios que yo sigo (o que sigue el usuario autenticado)
    const followingCount = await Follow.countDocuments({ "following_user": userId });

    // Contador de usuarios que me siguen a mi (que siguen al usuario autenticado)
    const followedCount = await Follow.countDocuments({ "followed_user": userId });

    // Contador de publicaciones del usuario autenticado
    const publicationsCount = await Publication.countDocuments({ "user_id": userId });

    // Devolver los contadores
    return res.status(200).json({
      status: "success",
      userId,
      name: user.name,
      last_name: user.last_name,
      followingCount: followingCount,
      followedCount: followedCount,
      publicationsCount: publicationsCount
    });

  } catch (error) {
    console.log("Error en los contadores", error)
    return res.status(500).send({
      status: "error",
      message: "Error en los contadores"
    });
  }
}