import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  FileText, 
  Shield, 
  ClipboardList, 
  Home, 
  Heart, 
  Laptop, 
  Scale,
  PenTool 
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  content: string;
  required: boolean;
}

interface SigningDocsProps {
  onComplete: () => void;
  isCompleted: boolean;
  data?: {
    documents?: Document[];
  };
}

const SigningDocs: React.FC<SigningDocsProps> = ({ onComplete, isCompleted, data }) => {
  const [signedDocs, setSignedDocs] = useState<Set<string>>(new Set());

  // Use dynamic documents if available, otherwise fall back to hardcoded documents
  const dynamicDocuments = data?.documents || [];
  
  const defaultDocuments = [
    {
      id: 'employment-contract',
      title: 'Employment Contract',
      description: 'Your official employment agreement including salary, benefits, and terms of employment.',
      type: 'Contract',
      icon: FileText,
      required: true,
      pages: 8
    },
    {
      id: 'nda',
      title: 'Non-Disclosure Agreement',
      description: 'Confidentiality agreement protecting company and customer information.',
      type: 'Legal',
      icon: Shield,
      required: true,
      pages: 3
    },
    {
      id: 'code-of-conduct',
      title: 'Code of Conduct',
      description: 'Guidelines for professional behavior and ethical standards.',
      type: 'Policy',
      icon: ClipboardList,
      required: true,
      pages: 5
    },
    {
      id: 'remote-work-policy',
      title: 'Remote Work Policy',
      description: 'Guidelines and expectations for remote and hybrid work arrangements.',
      type: 'Policy',
      icon: Home,
      required: true,
      pages: 4
    },
    {
      id: 'benefits-enrollment',
      title: 'Benefits Enrollment',
      description: 'Health insurance, dental, vision, and retirement plan selections.',
      type: 'Benefits',
      icon: Heart,
      required: true,
      pages: 6
    },
    {
      id: 'equipment-agreement',
      title: 'Equipment Usage Agreement',
      description: 'Terms for company equipment usage and return policy.',
      type: 'Policy',
      icon: Laptop,
      required: false,
      pages: 2
    }
  ];

  // Convert dynamic documents to match default structure
  const documents = dynamicDocuments.length > 0 
    ? dynamicDocuments.map(doc => ({
        id: doc.id,
        title: doc.title,
        description: doc.content.substring(0, 100) + '...',
        type: 'Document',
        icon: FileText,
        required: doc.required,
        pages: Math.ceil(doc.content.length / 300) // Estimate pages based on content length
      }))
    : defaultDocuments;

  const handleDocumentSign = (docId: string) => {
    const newSignedDocs = new Set(signedDocs);
    newSignedDocs.add(docId);
    setSignedDocs(newSignedDocs);
  };

  const requiredDocs = documents.filter(doc => doc.required);
  const allRequiredSigned = requiredDocs.every(doc => signedDocs.has(doc.id));

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'Contract':
        return 'bg-primary/10 text-primary';
      case 'Legal':
        return 'bg-destructive/10 text-destructive';
      case 'Policy':
        return 'bg-secondary text-secondary-foreground';
      case 'Benefits':
        return 'bg-accent text-accent-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Document Signing</h1>
        <p className="text-muted-foreground">Review and sign your employment documents</p>
        <div className="text-sm text-muted-foreground">
          Signed: {signedDocs.size}/{documents.length} documents 
          ({requiredDocs.filter(doc => signedDocs.has(doc.id)).length}/{requiredDocs.length} required)
        </div>
      </div>

      <div className="bg-accent/30 border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <PenTool className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Digital Signature Process</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Click "Review & Sign" to open each document. After reviewing, you'll be prompted to 
          provide your digital signature. All signatures are legally binding and encrypted.
        </p>
      </div>

      <div className="space-y-4">
        {documents.map((doc) => {
          const Icon = doc.icon;
          const isSigned = signedDocs.has(doc.id);
          
          return (
            <Card 
              key={doc.id}
              className={`border ${
                isSigned 
                  ? 'border-primary/30 bg-primary/5' 
                  : doc.required 
                    ? 'border-destructive/30 bg-destructive/5' 
                    : 'border-border'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-foreground flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      {doc.title}
                      {doc.required && <span className="text-destructive text-sm">*</span>}
                      {isSigned && <CheckCircle className="h-4 w-4 text-primary" />}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${getDocumentTypeColor(doc.type)}`}>
                        {doc.type}
                      </span>
                      <span>{doc.pages} pages</span>
                      {doc.required && <span className="text-destructive font-medium">Required</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {!isSigned ? (
                      <Button
                        onClick={() => handleDocumentSign(doc.id)}
                        size="sm"
                      >
                        <PenTool className="h-4 w-4 mr-2" />
                        Review & Sign
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Signed
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {doc.description}
                </p>
                {isSigned && (
                  <div className="mt-3 bg-primary/10 border border-primary/20 rounded p-3">
                    <div className="text-primary text-sm">
                      <strong>Signed:</strong> {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </div>
                    <div className="text-primary/70 text-xs mt-1">
                      Digital signature ID: {doc.id}-{Date.now().toString().slice(-6)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold text-foreground">Legal Notice</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            By signing these documents electronically, you acknowledge that your electronic signature 
            has the same legal effect as a handwritten signature. Please ensure you have read and 
            understood all documents before signing.
          </p>
        </CardContent>
      </Card>

      <div className="text-center pt-4">
        {!isCompleted && (
          <Button 
            onClick={onComplete}
            disabled={!allRequiredSigned}
            variant={allRequiredSigned ? "default" : "secondary"}
            className="px-8 py-3 text-lg"
          >
            {allRequiredSigned ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Document Signing
              </>
            ) : (
              'Sign all required documents to continue'
            )}
          </Button>
        )}
        {isCompleted && (
          <div className="flex items-center justify-center gap-2 text-primary font-semibold">
            <CheckCircle className="h-4 w-4" />
            All documents signed successfully!
          </div>
        )}
      </div>
    </div>
  );
};

export default SigningDocs; 