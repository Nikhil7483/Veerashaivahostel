import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import { Plus, MapPin, Calendar } from 'lucide-react';

const StudentLostFoundPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('LOST');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/lost-found');
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/lost-found', {
        item_name: itemName,
        description,
        location,
        date: new Date().toISOString().split('T')[0],
        status,
      });
      setModalOpen(false);
      setItemName('');
      setDescription('');
      setLocation('');
      fetchItems();
    } catch (err) {
      alert('Failed to report item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lost & Found Community Board</h1>
          <p className="text-xs text-slate-500 font-medium">
            Report misplaced belongings or inspect recovered articles held safely in the Warden Office.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Report Item</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading items...</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          No lost or found items recorded.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-3 text-xs"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-extrabold text-slate-900 text-sm">{item.item_name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.status === 'RETURNED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.status === 'FOUND'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl">
                  "{item.description}"
                </p>

                <div className="space-y-1 text-[11px] text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.location}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(item.date)}</span>
                  </div>
                  {item.return_notes && (
                    <div className="p-2 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-medium mt-1">
                      Resolution: {item.return_notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                Contact Warden office to claim found property
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Report Misplaced / Found Item" maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Item Title *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Scientific Calculator, Laptop Charger, Blue Umbrella"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Classification *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold"
            >
              <option value="LOST">I LOST THIS ITEM</option>
              <option value="FOUND">I FOUND THIS ITEM</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Location on Campus *</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Badminton court, 2nd floor library..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Description & Distinctive Marks *</label>
            <textarea
              rows="3"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Color, brand, serial number, stickers..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Post to Board'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentLostFoundPage;
