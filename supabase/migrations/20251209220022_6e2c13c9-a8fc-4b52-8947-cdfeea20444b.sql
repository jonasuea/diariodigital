-- Create storage bucket for documents/memorandos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for document uploads
CREATE POLICY "Anyone can view documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documentos');

CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Authenticated users can update documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documentos');

CREATE POLICY "Authenticated users can delete documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'documentos');