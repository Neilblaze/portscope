"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check } from "lucide-react";
import { SiNpm, SiPnpm, SiYarn, SiBun } from "react-icons/si";

interface PackageTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  command: string;
  packageName: string;
  extra: string;
}

const tabs: PackageTab[] = [
  {
    id: "npm",
    label: "npm",
    icon: <SiNpm className="w-4 h-4" />,
    command: "npx",
    packageName: "github:Neilblaze/portscope",
    extra: "",
  },
  {
    id: "pnpm",
    label: "pnpm",
    icon: <SiPnpm className="w-4 h-4" />,
    command: "pnpm dlx",
    packageName: "github:Neilblaze/portscope",
    extra: "",
  },
  {
    id: "yarn",
    label: "yarn",
    icon: <SiYarn className="w-4 h-4" />,
    command: "yarn dlx",
    packageName: "github:Neilblaze/portscope",
    extra: "",
  },
  {
    id: "bun",
    label: "bun",
    icon: <SiBun className="w-4 h-4" />,
    command: "bunx",
    packageName: "github:Neilblaze/portscope",
    extra: "",
  },
];

const PackageInstallerTabs = () => {
  const [activeTab, setActiveTab] = useState<string>("npm");
  const [copied, setCopied] = useState(false);

  const activeCommand = tabs.find((tab) => tab.id === activeTab)!;

  const handleCopy = () => {
    const commandText = `${activeCommand.command} ${activeCommand.packageName}${activeCommand.extra ? " " + activeCommand.extra : ""}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(commandText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto relative rounded-2xl overflow-hidden shadow-xl shadow-black/20 p-[1px] group bg-border/40">
      <div className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg,transparent_0%,#fca311_50%,transparent_100%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative rounded-[15px] bg-[#0d1117] w-full h-full flex flex-col overflow-hidden ring-1 ring-white/10">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10 bg-[#161b22]">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          <div className="ml-2 text-xs font-medium text-[#8b949e]">Terminal</div>
        </div>

        <div className="flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none bg-[#161b22] p-0 h-11 border-b border-white/5">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="relative h-11 rounded-none border-b-2 border-transparent bg-transparent px-5 pb-3 pt-3 font-medium text-[#8b949e] hover:text-[#c9d1d9] data-[state=active]:border-[#fca311] data-[state=active]:text-[#c9d1d9] data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
                >
                  {tab.icon} <span className="ml-2.5 tracking-wide">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative p-5">
            <div className="flex items-center justify-between">
              <pre className="font-mono text-sm w-full overflow-x-auto text-[#e6edf3]">
                <span className="text-[#ff7b72]">{activeCommand.command}</span>{" "}
                <span className="text-[#a5d6ff]">{activeCommand.packageName}</span>{" "}
                {activeCommand.extra && (
                  <span className="text-[#8b949e]">
                    {activeCommand.extra}
                  </span>
                )}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 shrink-0 text-[#8b949e] hover:text-[#c9d1d9] hover:bg-white/10 transition-colors"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#3fb950]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="sr-only">Copy command</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageInstallerTabs;
