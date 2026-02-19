-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for photo uploads
CREATE POLICY "Anyone can view photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'fotos');

CREATE POLICY "Authenticated users can upload photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'fotos');

CREATE POLICY "Authenticated users can update photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'fotos');

CREATE POLICY "Authenticated users can delete photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'fotos');