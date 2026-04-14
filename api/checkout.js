const Stripe = require('stripe');
const { MongoClient } = require('mongodb');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const client = new MongoClient(process.env.MONGODB_URI);

export default async function handler(req, res) {
    // Permitir que el frontend acceda (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { items, email, nombre, total } = req.body;

        // 1. Crear el intento de pago en Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total * 100), // Stripe usa centavos
            currency: 'mxn',
            receipt_email: email,
        });

        // 2. Guardar en MongoDB Atlas
        await client.connect();
        const db = client.db('el_quesillo');
        await db.collection('pedidos').insertOne({
            cliente: nombre,
            email,
            items,
            total,
            stripeId: paymentIntent.id,
            status: 'pendiente',
            fecha: new Date()
        });

        // 3. Enviar el "secreto" al frontend para completar el cobro
        res.status(200).json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}