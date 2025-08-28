import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

// Importation des services Firebase depuis le fichier de configuration
import { db } from '@/firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext'; // Importation du contexte d'authentification

// Définition des types pour les messages
interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
}

// Définition des types pour les données Firebase
interface Product {
    name: string;
    description: string;
    images: string[];
    price: string;
    sellerName: string;
}

interface Seller {
    name: string;
    rating_score: number | null;
}

// Variables globales de l'environnement Canvas
declare const __app_id: string | undefined;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const WORKER_URL = "https://agent.israelntalu328.workers.dev/chat";

export default function AssistantChatScreen() {
    const router = useRouter();
    const { authUser, isAuthenticated } = useAuth(); // Utilisation de l'état d'authentification
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [allProducts, setAllProducts] = useState<Product[]>([]);

    // Récupération des produits après l'authentification
    useEffect(() => {
        const fetchProducts = async () => {
            // S'assurer que l'utilisateur est authentifié et que la base de données est disponible
            if (!isAuthenticated || !db) return;

            try {
                const querySnapshot = await getDocs(collection(db, "products"));
                const productsData: Product[] = querySnapshot.docs.map(doc => doc.data() as Product);
                setAllProducts(productsData);

                const welcomeMessage = {
                    id: 'welcome',
                    text: 'Bonjour ! Je suis l’assistant intelligent de Yass DRC. Je peux vous aider à trouver des produits, vérifier la fiabilité des vendeurs, et répondre à vos questions sur la plateforme.',
                    sender: 'bot' as const
                };
                setMessages([welcomeMessage]);
            } catch (error) {
                console.error("Erreur lors de la récupération des produits :", error);
                setMessages([{
                    id: 'init_error',
                    text: "Désolé, une erreur est survenue lors de l'initialisation de l'application. Veuillez réessayer plus tard.",
                    sender: 'bot' as const
                }]);
            }
        };

        fetchProducts();
    }, [isAuthenticated, db]);

    // Fonction pour gérer l'affichage des messages (incluant les messages JSON)
    const renderMessage = ({ item }: { item: Message }) => {
        let content = <Text style={styles.messageText}>{item.text}</Text>;
        let bubbleStyle = item.sender === 'user' ? styles.userBubble : styles.botBubble;
        let alignment: "flex-start" | "flex-end" = item.sender === 'user' ? "flex-end" : "flex-start";

        try {
            const data = JSON.parse(item.text);
            if (data.name && data.description && data.images && data.sellerName) {
                // C'est un produit
                const imageUrl = data.images.length > 0 ? data.images[0] : `https://placehold.co/150x150/E0E0E0/333333?text=Image+non+disponible`;
                content = (
                    <View>
                        <Text style={styles.productTitle}>Voici un produit qui pourrait vous intéresser :</Text>
                        <View style={styles.productCard}>
                            <View style={styles.productImageContainer}>
                                <Text>Image de {data.name}</Text>
                            </View>
                            <View style={styles.productDetails}>
                                <Text style={styles.productName}>{data.name}</Text>
                                <Text style={styles.productPrice}>Prix : {data.price} FC</Text>
                                <Text style={styles.productSeller}>Vendeur : {data.sellerName}</Text>
                                <Text style={styles.productDescription}>{data.description}</Text>
                            </View>
                        </View>
                    </View>
                );
            } else if (data.seller_name && typeof data.rating_score !== 'undefined') {
                // C'est la fiabilité du vendeur
                const fiabiliteText = data.is_reliable ? "ce vendeur est considéré comme fiable." : "ce vendeur pourrait être moins fiable. Procédez avec prudence.";
                const fiabiliteNote = data.rating_score !== null ? `Note de fiabilité : ${data.rating_score}/10.` : "Aucune note de fiabilité disponible.";
                content = (
                    <View>
                        <Text style={styles.sellerTitle}>Informations de fiabilité pour le vendeur : {data.seller_name}</Text>
                        <Text style={styles.sellerText}>{fiabiliteNote}</Text>
                        <Text style={styles.sellerText}>Basé sur notre système d'avis et les retours des clients, {fiabiliteText}</Text>
                    </View>
                );
            } else {
                content = <Text style={styles.messageText}>{item.text}</Text>;
            }
        } catch (e) {
            // Si la chaîne n'est pas un JSON valide, l'afficher comme texte simple
            content = <Text style={styles.messageText}>{item.text}</Text>;
        }

        return (
            <View style={[styles.messageBubble, bubbleStyle, { alignSelf: alignment }]}>
                {content}
            </View>
        );
    };

    // Fonction principale pour gérer l'envoi du message
    const handleSendMessage = async () => {
        if (userInput.trim() === '') {
            return;
        }

        const userMessageText = userInput.trim();
        const userMessage = { id: Date.now().toString(), text: userMessageText, sender: 'user' as const };

        setMessages(prevMessages => [...prevMessages, userMessage]);
        setUserInput('');
        setLoading(true);

        const fiabiliteQuery = userMessageText.toLowerCase().includes('fiabilité') || userMessageText.toLowerCase().includes('fiable');
        const vendeurQuery = userMessageText.toLowerCase().includes('vendeur');

        if (fiabiliteQuery && vendeurQuery) {
            // Logique de vérification de la fiabilité du vendeur
            const sellerNameMatch = userMessageText.match(/vendeur\s(.+)/i);
            if (!sellerNameMatch || !sellerNameMatch[1]) {
                const botMessage = { id: Date.now().toString(), text: "Veuillez spécifier le nom du vendeur pour que je puisse vérifier sa fiabilité.", sender: 'bot' as const };
                setMessages(prevMessages => [...prevMessages, botMessage]);
                setLoading(false);
                return;
            }

            const sellerName = sellerNameMatch[1].trim().toLowerCase();

            try {
                const q = query(collection(db, `artifacts/${appId}/users`), where("name", "==", sellerName));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const sellerData = querySnapshot.docs[0].data() as Seller;
                    const ratingScore = sellerData.rating_score || null;
                    const isReliable = ratingScore !== null && ratingScore >= 7.5;

                    const responseJSON = JSON.stringify({
                        seller_name: sellerData.name,
                        rating_score: ratingScore,
                        is_reliable: isReliable
                    });
                    const botMessage = { id: Date.now().toString(), text: responseJSON, sender: 'bot' as const };
                    setMessages(prevMessages => [...prevMessages, botMessage]);
                } else {
                    const botMessage = { id: Date.now().toString(), text: `Désolé, je n'ai trouvé aucune information sur un vendeur nommé "${sellerName}". Veuillez vérifier le nom.`, sender: 'bot' as const };
                    setMessages(prevMessages => [...prevMessages, botMessage]);
                }
            } catch (error) {
                console.error("Erreur de requête Firestore :", error);
                const errorMessage = { id: Date.now().toString(), text: `Une erreur s'est produite lors de la vérification du vendeur : ${(error as Error).message}`, sender: 'bot' as const };
                setMessages(prevMessages => [...prevMessages, errorMessage]);
            } finally {
                setLoading(false);
            }
        } else {
            // Logique pour envoyer le message au worker
            try {
                const structuredPrompt = `
                    Vous êtes un assistant de produits conversationnel pour la plateforme Yass DRC. Répondez aux questions en vous basant sur la liste de produits et le contexte de Yass DRC.
                    Plan de Yass DRC : Nom : Yass DRC, Type : Marketplace en ligne, Localisation : RDC. Objectif : acheter et vendre des produits facilement.
                    Fonctionnalités : recherche, navigation, fiche produit, panier, paiement (Mobile Money), compte utilisateur, avis et fiabilité (système de notation), assistance IA.
                    Processus d'achat : connexion > recherche > ajout au panier > paiement > confirmation.
                    Vendeurs : créent un compte pour publier des produits.
                    
                    Liste de produits disponible : ${JSON.stringify(allProducts)}.
                    
                    Requête de l'utilisateur : "${userMessageText}".
                    
                    **Instructions (en français) :**
                    
                    1.  **Recherche de Produit :** Si la requête est une recherche de produit, trouvez le produit pertinent et répondez en JSON. Sinon, demandez plus de détails.
                    2.  **Aide sur la Plateforme :** Si la requête est une question sur le fonctionnement de Yass DRC, utilisez le plan détaillé pour répondre de manière informative.
                    3.  **Réclamation/Problème :** Si la requête concerne un problème, répondez avec empathie et redirigez l'utilisateur vers le support client.
                    4.  **Conversation Générale :** Pour toute autre requête, répondez de manière amicale.
                    5.  **Interdiction :** NE JAMAIS générer de code ou de listes de données.
                `;

                const response = await fetch(WORKER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: authUser?.id || 'anonymous', // Utilisation de l'ID utilisateur depuis le contexte
                        message: structuredPrompt,
                        products_data: allProducts
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                if (data && data.reply) {
                    const botMessage = { id: Date.now().toString(), text: data.reply, sender: 'bot' as const };
                    setMessages(prevMessages => [...prevMessages, botMessage]);
                } else {
                    const errorMessage = { id: Date.now().toString(), text: "Désolé, une erreur est survenue lors de la communication avec l'assistant.", sender: 'bot' as const };
                    setMessages(prevMessages => [...prevMessages, errorMessage]);
                }
            } catch (error) {
                console.error("Erreur lors de l'envoi du message au worker:", error);
                const errorMessage = { id: Date.now().toString(), text: "Désolé, une erreur est survenue lors de la communication avec l'assistant.", sender: 'bot' as const };
                setMessages(prevMessages => [...prevMessages, errorMessage]);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#6C63FF" />
                </TouchableOpacity>
                <Text style={styles.title}>Assistant IA</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                inverted
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6C63FF" />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inputContainer}
                keyboardVerticalOffset={90}
            >
                <TextInput
                    style={styles.textInput}
                    placeholder="Écrivez votre message..."
                    value={userInput}
                    onChangeText={setUserInput}
                    onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity
                    style={styles.sendButton}
                    onPress={handleSendMessage}
                    disabled={loading || userInput.trim() === ''}
                >
                    <Ionicons name="send" size={24} color="#fff" />
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    list: {
        paddingVertical: 10,
    },
    messageBubble: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 20,
        maxWidth: '80%',
    },
    userBubble: {
        backgroundColor: '#6C63FF',
        borderBottomRightRadius: 5,
    },
    botBubble: {
        backgroundColor: '#e0e0e0',
        borderBottomLeftRadius: 5,
    },
    messageText: {
        fontSize: 16,
        color: '#333',
    },
    productCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 10,
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#e0e0e0'
    },
    productTitle: {
        fontWeight: 'bold',
        marginBottom: 5
    },
    productImageContainer: {
        width: '100%',
        height: 150,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8
    },
    productDetails: {
        marginTop: 10
    },
    productName: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#6C63FF'
    },
    productPrice: {
        fontSize: 14,
        color: '#555'
    },
    productSeller: {
        fontSize: 14,
        color: '#555'
    },
    productDescription: {
        fontSize: 12,
        fontStyle: 'italic',
        color: '#888',
        marginTop: 5
    },
    sellerTitle: {
        fontWeight: 'bold',
        marginBottom: 5
    },
    sellerText: {
        fontSize: 14,
        color: '#333'
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    textInput: {
        flex: 1,
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 25,
        marginRight: 10,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6C63FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        alignSelf: 'center',
        marginVertical: 10,
    }
});
