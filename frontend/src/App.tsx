import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api/client';
import { Persona, Team, WorkItem } from './types';
import { Navbar, NavTab } from './components/Navbar';
import { FilterBar, QueuePreset } from './components/FilterBar';
import { WorkQueueTable } from './components/WorkQueueTable';
import { WorkItemDrawer } from './components/WorkItemDrawer';
import { CreateWorkItemModal } from './components/CreateWorkItemModal';
import { OverviewView } from './views/OverviewView';
import { ConcurrencyStudioView } from './views/ConcurrencyStudioView';
import { BenchmarksView } from './views/BenchmarksView';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: 'easeOut' as const },
};

// Seeded personas fallback in case backend is initializing
const SEEDED_PERSONAS: Persona[] = [
  {
    id: 'usr_aarav',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@opspulse.internal',
    roles: { team_payments: 'OPERATOR', team_infra: 'REQUESTER' },
  },
  {
    id: 'usr_priya',
    name: 'Priya Nair',
    email: 'priya.nair@opspulse.internal',
    roles: { team_payments: 'APPROVER', team_compliance: 'LEAD' },
  },
  {
    id: 'usr_rohan',
    name: 'Rohan Desai',
    email: 'rohan.desai@opspulse.internal',
    roles: { team_infra: 'LEAD', team_payments: 'OPERATOR' },
  },
  {
    id: 'usr_sneha',
    name: 'Sneha Kulkarni',
    email: 'sneha.kulkarni@opspulse.internal',
    roles: { team_support: 'OPERATOR', team_payments: 'REQUESTER' },
  },
  {
    id: 'usr_vikram',
    name: 'Vikram Rao',
    email: 'vikram.rao@opspulse.internal',
    roles: { team_compliance: 'APPROVER', team_infra: 'APPROVER' },
  },
  {
    id: 'usr_ananya',
    name: 'Ananya Sharma',
    email: 'ananya.sharma@opspulse.internal',
    roles: { team_support: 'LEAD' },
  },
];

const SEEDED_TEAMS: Team[] = [
  { id: 'team_payments', name: 'Payments & Billing Operations' },
  { id: 'team_infra', name: 'Cloud Infrastructure & SRE' },
  { id: 'team_compliance', name: 'Legal & Regulatory Compliance' },
  { id: 'team_support', name: 'Tier-3 Customer Escalations' },
];

export function App() {
  // Navigation State (4 Dedicated Pages)
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');

  // Personas & Active Operator State
  const [personas, setPersonas] = useState<Persona[]>(SEEDED_PERSONAS);
  const [activePersona, setActivePersona] = useState<Persona>(SEEDED_PERSONAS[0]);
  const [teams, setTeams] = useState<Team[]>(SEEDED_TEAMS);

  // Global Scale & Latency Metric
  const [totalItems, setTotalItems] = useState(10015);
  const [lastQueryLatencyMs, setLastQueryLatencyMs] = useState(3.42);

  // Queue Filters & Smart Presets
  const [preset, setPreset] = useState<QueuePreset>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');

  // Keyset Pagination State
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [, setCursorHistory] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Detail Inspector Drawer
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [liveUpdatedId, setLiveUpdatedId] = useState<string | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial Data Fetching (Health, Personas, Teams)
  useEffect(() => {
    async function initMetadata() {
      try {
        const health = await api.fetchHealth();
        if (health.total_work_items) {
          setTotalItems(health.total_work_items);
        }
      } catch (e) {
        // fallback to default scale
      }

      try {
        const fetchedPersonas = await api.fetchPersonas();
        if (fetchedPersonas && fetchedPersonas.length > 0) {
          setPersonas(fetchedPersonas);
          setActivePersona(fetchedPersonas[0]);
        }
      } catch (e) {
        // use fallback seeded personas
      }

      try {
        const fetchedTeams = await api.fetchTeams();
        if (fetchedTeams && fetchedTeams.length > 0) {
          setTeams(fetchedTeams);
        }
      } catch (e) {
        // use fallback seeded teams
      }
    }
    initMetadata();
  }, []);

  // Fetch Work Items based on current filters and keyset cursor
  const loadWorkItems = useCallback(
    async (targetCursor: string | null = null) => {
      setIsLoading(true);
      try {
        let statusParam = selectedStatus || undefined;
        let priorityParam = selectedPriority || undefined;
        let assigneeParam: string | undefined = undefined;

        // Apply Preset Overrides
        if (preset === 'UNCLAIMED') {
          statusParam = 'TRIAGE';
          assigneeParam = 'UNASSIGNED';
        } else if (preset === 'NEEDS_APPROVAL') {
          statusParam = 'PENDING_APPROVAL';
        } else if (preset === 'MY_ASSIGNED') {
          assigneeParam = activePersona.id;
        } else if (preset === 'HIGH_PRIORITY') {
          priorityParam = 'CRITICAL';
        }

        const data = await api.fetchWorkItems(
          {
            cursor: targetCursor || undefined,
            limit: 50,
            query: debouncedSearch || undefined,
            status: statusParam,
            team_id: selectedTeam || undefined,
            priority: priorityParam,
            assignee_id: assigneeParam,
          },
          activePersona.id
        );

        setWorkItems(data.items);
        setCursor(data.next_cursor || null);
        setHasMore(data.has_more);
        setLastQueryLatencyMs(data.query_time_ms);
        if (data.total_count) {
          setTotalItems(data.total_count);
        }
      } catch (err: any) {
        console.error('Failed to load work items:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      preset,
      debouncedSearch,
      selectedTeam,
      selectedStatus,
      selectedPriority,
      activePersona.id,
    ]
  );

  // Trigger reload whenever filters or preset or activePersona changes
  useEffect(() => {
    setCursorHistory([]);
    loadWorkItems(null);
  }, [loadWorkItems]);

  // Keyset Pagination Navigation
  const handleNextPage = () => {
    if (!cursor) return;
    setCursorHistory((prev) => [...prev, cursor]);
    loadWorkItems(cursor);
  };

  const handleResetPagination = () => {
    setCursorHistory([]);
    loadWorkItems(null);
  };

  // Live Server-Sent Events (SSE) Listener
  useEffect(() => {
    const sse = new EventSource('/api/v1/events/stream');

    sse.addEventListener('work_item_updated', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const updatedItem = payload.work_item as WorkItem;
        if (updatedItem) {
          setLiveUpdatedId(updatedItem.id);
          setTimeout(() => setLiveUpdatedId(null), 3500);

          // Update in table if visible
          setWorkItems((prev) =>
            prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
          );

          // If currently open in drawer, update inspector view
          setSelectedItem((current) =>
            current && current.id === updatedItem.id ? updatedItem : current
          );
        }
      } catch (e) {
        console.warn('Error parsing SSE work_item_updated event:', e);
      }
    });

    sse.addEventListener('work_item_claimed', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const updatedItem = payload.work_item as WorkItem;
        if (updatedItem) {
          setWorkItems((prev) =>
            prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
          );
          setSelectedItem((current) =>
            current && current.id === updatedItem.id ? updatedItem : current
          );
        }
      } catch (e) {
        // ignore
      }
    });

    return () => {
      sse.close();
    };
  }, []);

  const handleResetFilters = () => {
    setPreset('ALL');
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedTeam('');
    setSelectedStatus('');
    setSelectedPriority('');
  };

  const handleItemUpdated = (updated: WorkItem) => {
    setWorkItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setSelectedItem(updated);
  };

  const handleItemCreated = (newItem: WorkItem) => {
    setWorkItems((prev) => [newItem, ...prev]);
    setSelectedItem(newItem);
    setTotalItems((prev) => prev + 1);
  };

  const handleNavigateFromOverview = (tab: NavTab, targetPreset?: QueuePreset) => {
    if (targetPreset) {
      setPreset(targetPreset);
    }
    setCurrentTab(tab);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#F4F7FB] to-[#EEF2F6] dark:from-[#000000] dark:via-[#08080A] dark:to-[#121215] text-slate-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-slate-300 dark:selection:bg-zinc-800 dark:selection:text-zinc-100 relative transition-colors duration-500">
      {/* Subtle top ambient radial glow — clean monochrome highlight with zero blue tint */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(1200px_circle_at_50%_0%,rgba(255,255,255,0.85),transparent)] dark:bg-[radial-gradient(1200px_circle_at_50%_0%,rgba(255,255,255,0.03),transparent)] z-0" />

      {/* 1. Persistent Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        personas={personas}
        activePersona={activePersona}
        onSelectPersona={setActivePersona}
        onOpenCreate={() => setShowCreateModal(true)}
        totalItems={totalItems}
        lastQueryLatencyMs={lastQueryLatencyMs}
      />

      {/* 2. Main Page Views Container — AnimatePresence page transitions (0.15s fade/slide) */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {currentTab === 'overview' && (
            <motion.div key="overview" className="flex-1 flex flex-col" {...PAGE_TRANSITION}>
              <OverviewView
                onNavigate={handleNavigateFromOverview}
                totalItems={totalItems}
                lastLatencyMs={lastQueryLatencyMs}
              />
            </motion.div>
          )}

          {currentTab === 'workspace' && (
            <motion.div key="workspace" className="flex-1 flex flex-col min-h-0" {...PAGE_TRANSITION}>
              {/* Filter Bar */}
              <FilterBar
                preset={preset}
                onSelectPreset={setPreset}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                teams={teams}
                selectedTeam={selectedTeam}
                onSelectTeam={setSelectedTeam}
                selectedStatus={selectedStatus}
                onSelectStatus={setSelectedStatus}
                selectedPriority={selectedPriority}
                onSelectPriority={setSelectedPriority}
                onResetFilters={handleResetFilters}
                lastLatencyMs={lastQueryLatencyMs}
              />

              {/* Keyset Table and Slide-Over Drawer */}
              <main className="flex-1 flex flex-col min-h-0 relative">
                <WorkQueueTable
                  items={workItems}
                  selectedItem={selectedItem}
                  onSelectItem={setSelectedItem}
                  nextCursor={cursor}
                  hasMore={hasMore}
                  onNextPage={handleNextPage}
                  onResetPagination={handleResetPagination}
                  queryTimeMs={lastQueryLatencyMs}
                  isLoading={isLoading}
                />
              </main>
            </motion.div>
          )}

          {currentTab === 'concurrency' && (
            <motion.div key="concurrency" className="flex-1 flex flex-col" {...PAGE_TRANSITION}>
              <ConcurrencyStudioView
                personas={personas}
                workItems={workItems}
                onItemUpdated={handleItemUpdated}
              />
            </motion.div>
          )}

          {currentTab === 'benchmarks' && (
            <motion.div key="benchmarks" className="flex-1 flex flex-col" {...PAGE_TRANSITION}>
              <BenchmarksView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Slide-Over Detail Drawer (Root Level for fixed viewport positioning & escape handling) */}
      {selectedItem && (
        <WorkItemDrawer
          item={selectedItem}
          activePersona={activePersona}
          onClose={() => setSelectedItem(null)}
          onItemUpdated={handleItemUpdated}
          liveUpdatedId={liveUpdatedId}
        />
      )}

      {/* 4. New Work Item Creation Modal */}
      {showCreateModal && (
        <CreateWorkItemModal
          teams={teams}
          activePersona={activePersona}
          onClose={() => setShowCreateModal(false)}
          onItemCreated={handleItemCreated}
        />
      )}
    </div>
  );
}

export default App;
