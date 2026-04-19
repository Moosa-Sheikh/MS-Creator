import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        setLocation("/");
      },
      onError: (error) => {
        toast({
          title: "Login failed",
          description: error.data?.error || "Incorrect password",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    loginMutation.mutate({ data: { password } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-sidebar relative overflow-hidden">
      <div 
        className="absolute inset-0 pointer-events-none opacity-20" 
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?q=80&w=2071&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'grayscale(100%)' }}
      ></div>
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>
      
      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-card border border-border/10 rounded-xl p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 mx-auto bg-primary text-primary-foreground flex items-center justify-center rounded-lg mb-4 text-xl font-bold font-mono shadow-inner">
              M
            </div>
            <h1 className="text-2xl font-bold text-foreground">Mockup Studio</h1>
            <p className="text-muted-foreground mt-2 text-sm">Enter your password to access your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-input/50 border-border/50 h-12 px-4 focus-visible:ring-primary/20"
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 font-medium" 
              disabled={loginMutation.isPending || !password}
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enter Studio"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
