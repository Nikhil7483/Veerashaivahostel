import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import { useNotification } from '../../context/NotificationContext';
import {
  Plus,
  CheckCircle,
  MapPin,
  Calendar,
  Search,
  Package,
  AlertCircle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  Edit3,
  Trash2
} from 'lucide-react';

const LostFoundPage = () => {
  const { toast, confirm } = useNotification();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'FOUND' | 'LOST' | 'RETURNED'
  const [searchQuery, setSearchQuery] = useState('');

  // Status update modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStatus, setNewStatus] = useState('RETURNED');
  const [returnNotes, setReturnNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Full Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    item_name: '',
    description: '',
    location: '',
    date: '',
    status: 'FOUND',
    return_notes: '',
  });

  // Add Item Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    status: 'FOUND',
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await api.get('/lost-found', { params });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [statusFilter]);

  // Quick Status Update
  const openUpdateModal = (item) => {
    setSelectedItem(item);
    setNewStatus(item.status === 'LOST' ? 'FOUND' : 'RETURNED');
    setReturnNotes(item.return_notes || '');
    setUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/lost-found/${selectedItem.id}/status`, {
        status: newStatus,
        return_notes: returnNotes,
      });
      setUpdateModalOpen(false);
      toast.success(`Custody status for "${selectedItem.item_name}" updated to ${newStatus}.`);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Full Edit
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditFormData({
      item_name: item.item_name || '',
      description: item.description || '',
      location: item.location || '',
      date: item.date || new Date().toISOString().split('T')[0],
      status: item.status || 'FOUND',
      return_notes: item.return_notes || '',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/lost-found/${editingItem.id}`, editFormData);
      setEditModalOpen(false);
      toast.success(`Details for "${editFormData.item_name}" updated successfully.`);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update item details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item) => {
    const confirmed = await confirm({
      title: 'Delete Lost & Found Record',
      message: `Are you sure you want to permanently delete "${item.item_name}" from the repository? This action cannot be undone.`,
      confirmText: 'Delete Item',
      cancelText: 'Cancel',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/lost-found/${item.id}`);
      toast.success(`"${item.item_name}" was permanently removed.`);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete item.');
    }
  };

  // Create Item
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/lost-found', formData);
      setAddModalOpen(false);
      toast.success(`"${formData.item_name}" was logged successfully.`);
      fetchItems();
      setFormData({
        item_name: '',
        description: '',
        location: '',
        date: new Date().toISOString().split('T')[0],
        status: 'FOUND',
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record article.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.item_name && item.item_name.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q)) ||
      (item.reported_by && item.reported_by.toLowerCase().includes(q))
    );
  });

  // Calculate live KPI statistics
  const totalCount = items.length;
  const foundInCustodyCount = items.filter((i) => i.status === 'FOUND').length;
  const lostReportedCount = items.filter((i) => i.status === 'LOST').length;
  const returnedCount = items.filter((i) => i.status === 'RETURNED').length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lost & Found Repository</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Campus recovery registry for resident belongings, study materials, and personal devices.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchItems}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Log Found / Lost Item</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Registered</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-1">{totalCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">All logged articles</span>
        </div>

        <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">In Warden Custody</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-900 mt-1">{foundInCustodyCount}</p>
          <span className="text-[10px] text-blue-600/80 font-medium">Recovered & safely held</span>
        </div>

        <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Reported Missing</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{lostReportedCount}</p>
          <span className="text-[10px] text-amber-600/80 font-medium">Resident inquiries pending</span>
        </div>

        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Returned to Owner</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-1">{returnedCount}</p>
          <span className="text-[10px] text-emerald-600/80 font-medium">Successfully resolved</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items by name, location, keyword..."
            className="w-full text-xs font-semibold pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'FOUND', label: 'In Custody' },
            { id: 'LOST', label: 'Reported Lost' },
            { id: 'RETURNED', label: 'Returned' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${statusFilter === tab.id
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
          <span>Loading lost & found catalog...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200 space-y-2">
          <Package className="w-8 h-8 mx-auto text-slate-300" />
          <p className="font-bold text-slate-600">No items match your filter criteria.</p>
          <p className="text-[11px] text-slate-400">Click "Log Found / Lost Item" to record a new article.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isFound = item.status === 'FOUND';
            const isLost = item.status === 'LOST';
            const isReturned = item.status === 'RETURNED';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug truncate" title={item.item_name}>
                        {item.item_name}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">Reported by: {item.reported_by}</p>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${isReturned
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isFound
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                      >
                        {isReturned ? 'RETURNED' : isFound ? 'IN CUSTODY' : 'REPORTED LOST'}
                      </span>

                      {/* Edit & Delete Action Buttons in Header */}
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Edit Item Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description Box */}
                  <p className="text-xs text-slate-700 bg-slate-50/80 p-3 rounded-xl border border-slate-100 italic leading-relaxed">
                    "{item.description}"
                  </p>

                  {/* Metadata */}
                  <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDate(item.date)}</span>
                    </div>
                    {item.return_notes && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-900 rounded-xl text-[11px] font-semibold border border-emerald-200 mt-2 space-y-0.5">
                        <span className="text-[9px] uppercase font-bold text-emerald-700 block">Resolution Note:</span>
                        <span>{item.return_notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {isReturned ? (
                    <div className="flex-1 text-center text-[11px] font-bold text-emerald-700 bg-emerald-50/60 py-1.5 rounded-xl border border-emerald-200/60 flex items-center justify-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Handed Over &bull; Closed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => openUpdateModal(item)}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs active:scale-98"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Update Custody / Return</span>
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(item)}
                    className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                    title="Edit Item Details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="py-2 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                    title="Delete Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Update Custody / Return Status Modal */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title={`Update Article: ${selectedItem?.item_name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status Classification</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
            >
              <option value="FOUND">FOUND (Safe in Warden Custody)</option>
              <option value="LOST">LOST (Reported Misplaced by Student)</option>
              <option value="RETURNED">RETURNED (Handed over to verified owner)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Custody / Return Notes</label>
            <textarea
              rows="3"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="e.g. Handed over to student after verifying College ID Card / USN..."
              className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setUpdateModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
            >
              {submitting ? 'Updating...' : 'Save Custody Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Full Edit Item Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Item: ${editingItem?.item_name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Article Title *</label>
            <input
              type="text"
              required
              value={editFormData.item_name}
              onChange={(e) => setEditFormData({ ...editFormData, item_name: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Status Classification *</label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
              >
                <option value="FOUND">FOUND (In Custody)</option>
                <option value="LOST">LOST (Reported Missing)</option>
                <option value="RETURNED">RETURNED (To Owner)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Location Found / Misplaced *</label>
            <input
              type="text"
              required
              value={editFormData.location}
              onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Description & Identifying Marks *</label>
            <textarea
              rows="3"
              required
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Custody / Return Notes</label>
            <textarea
              rows="2"
              value={editFormData.return_notes}
              onChange={(e) => setEditFormData({ ...editFormData, return_notes: e.target.value })}
              placeholder="e.g. Handed over to student after ID verification..."
              className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log New Item Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Log Lost / Recovered Article"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Article Title *</label>
            <input
              type="text"
              required
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              placeholder="e.g. Casio fx-991EX Scientific Calculator"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Status Classification *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
            >
              <option value="FOUND">FOUND ARTICLE (Held in Warden Office)</option>
              <option value="LOST">LOST ARTICLE (Reported missing on campus)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Location Found / Misplaced *</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. 2nd Floor Study Room Table 3 / Dining Hall"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Date *</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Description & Identifying Marks *</label>
            <textarea
              rows="3"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Distinctive features, color, brand, stickers, serial details..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
            >
              {submitting ? 'Registering...' : 'Register Article'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LostFoundPage;
