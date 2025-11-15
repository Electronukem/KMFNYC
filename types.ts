
export interface MemeConcept {
  topText: string;
  bottomText: string;
  imagePrompt: string;
}

export interface ApprovedMemeConcept extends MemeConcept {
  modelUsed: 'gemini' | 'dalle';
}

export interface GeneratedMeme extends MemeConcept {
  id: string;
  imageUrl: string;
  altText: string;
  status: 'pending' | 'approved' | 'rejected';
  modelUsed: 'gemini' | 'dalle';
}