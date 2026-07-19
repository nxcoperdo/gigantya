import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { preferenceService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const FavoriteButton = ({ targetId, tipo }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Invitado: NO consultamos favoritos (endpoint protegido → 401 → el
    // interceptor global redirige a /login y rompería la página pública
    // del restaurante). Mostramos el corazón vacío y al tocar invitamos
    // a iniciar sesión.
    if (!isAuthenticated) {
      setIsFavorite(false);
      setLoading(false);
      return;
    }
    const checkFavoriteStatus = async () => {
      try {
        const res = await preferenceService.getFavorites(tipo);
        const found = res.data.find(f => f.target_id === targetId);
        setIsFavorite(!!found);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      } finally {
        setLoading(false);
      }
    };
    checkFavoriteStatus();
  }, [targetId, tipo, isAuthenticated]);

  const toggleFavorite = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Invitado: lo llevamos a iniciar sesión para poder guardar favoritos.
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const previousState = isFavorite;
    setIsFavorite(!previousState); // Optimistic UI update

    try {
      if (previousState) {
        await preferenceService.removeFavorite({ tipo, target_id: targetId });
      } else {
        await preferenceService.addFavorite({ tipo, target_id: targetId });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setIsFavorite(previousState); // Revert on error
    }
  };

  if (loading) return <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />;

  return (
    <button
      onClick={toggleFavorite}
      className="p-3 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-90 shadow-md"
      style={isFavorite
        ? { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', boxShadow: '0 0 0 2px var(--danger-border)' }
        : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }
      }
      onMouseEnter={(e) => { if (!isFavorite) e.currentTarget.style.color = 'var(--danger-text)'; }}
      onMouseLeave={(e) => { if (!isFavorite) e.currentTarget.style.color = 'var(--text-muted)'; }}
      title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
    >
      <Heart
        size={22}
        fill={isFavorite ? 'currentColor' : 'none'}
        className={`transition-all duration-300 ${isFavorite ? 'scale-110' : 'scale-100'}`}
      />
    </button>
  );
};

export default FavoriteButton;
