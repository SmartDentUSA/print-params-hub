-- Teste de atualização do Moonray S com uma imagem de exemplo
UPDATE models 
SET image_url = 'https://via.placeholder.com/400x300/blue/white?text=Moonray+S',
    updated_at = now()
WHERE slug = 'moonray-s';