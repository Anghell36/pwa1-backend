import Stripe from 'stripe';
import { MongoClient } from 'mongodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const client = new MongoClient(process.env.MONGODB_URI);

export default async function handler(req, res) {
    // Configurar CORS (permite solicitudes desde cualquier origen, ajusta si es necesario)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { items, nombre, email, total, rfc, razonSocial, usoCFDI } = req.body;

        if (!items || !nombre || !email || total === undefined) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        // 1. Crear PaymentIntent en Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total * 100), // Stripe maneja centavos
            currency: 'mxn',
            receipt_email: email,
            metadata: {
                nombre,
                rfc: rfc || '',
                razonSocial: razonSocial || ''
            }
        });

        // 2. Guardar pedido en MongoDB
        await client.connect();
        const db = client.db('el_quesillo');
        await db.collection('pedidos').insertOne({
            cliente: nombre,
            email,
            items,
            total,
            rfc: rfc || null,
            razonSocial: razonSocial || null,
            usoCFDI: usoCFDI || null,
            stripeId: paymentIntent.id,
            status: 'pendiente',
            fecha: new Date()
        });

        // 3. Devolver client_secret al frontend
        res.status(200).json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error('Error en checkout:', error);
        res.status(500).json({ error: error.message });
    } finally {
        // Cerrar conexión a MongoDB (opcional pero recomendado)
        // await client.close();
    }
}